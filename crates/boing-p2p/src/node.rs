//! P2P node — libp2p swarm with gossipsub, mdns, and block request/response.
//!
//! Propagates blocks and transactions; discovers peers via mDNS; fetches blocks on demand.

use std::sync::Arc;
use std::time::Duration;

use libp2p::futures::StreamExt;
use libp2p::gossipsub::{IdentTopic, MessageAuthenticity, ValidationMode};
#[cfg(feature = "mdns")]
use libp2p::mdns::tokio::Behaviour as Mdns;
use libp2p::request_response::{self, ProtocolSupport};
use libp2p::swarm::{NetworkBehaviour, SwarmEvent};
use libp2p::StreamProtocol;
use libp2p::gossipsub::PublishError;
use libp2p::{gossipsub, SwarmBuilder};
use tokio::sync::{mpsc, oneshot};
use tracing::{info, warn};

use crate::block_sync::{BlockRequest, BlockResponse};
use boing_primitives::{Block, Hash, Transaction};

const BLOCKS_TOPIC: &str = "boing/blocks";
const TRANSACTIONS_TOPIC: &str = "boing/transactions";

/// P2P events (incoming blocks/transactions and block fetch responses).
#[derive(Debug)]
pub enum P2pEvent {
    BlockReceived(Block),
    TransactionReceived(Transaction),
    /// Response from request_block (by hash or height).
    BlockFetched(Block),
}

enum BroadcastMsg {
    Block(Block),
    Transaction(Transaction),
}

enum Command {
    RequestBlock(libp2p::PeerId, BlockRequest),
    GetPeers(oneshot::Sender<Vec<libp2p::PeerId>>),
    Dial(String),
}

/// Provides blocks for the request/response protocol.
pub trait BlockProvider: Send + Sync {
    fn get_block_by_hash(&self, hash: &Hash) -> Option<Block>;
    fn get_block_by_height(&self, height: u64) -> Option<Block>;
}

type BlockSyncBehaviour = request_response::cbor::Behaviour<BlockRequest, BlockResponse>;

#[cfg(feature = "mdns")]
#[derive(NetworkBehaviour)]
#[behaviour(prelude = "libp2p_swarm::derive_prelude")]
struct BoingBehaviour {
    mdns: Mdns,
    gossipsub: gossipsub::Behaviour,
    block_sync: BlockSyncBehaviour,
}

#[cfg(not(feature = "mdns"))]
#[derive(NetworkBehaviour)]
#[behaviour(prelude = "libp2p_swarm::derive_prelude")]
struct BoingBehaviour {
    gossipsub: gossipsub::Behaviour,
    block_sync: BlockSyncBehaviour,
}

/// P2P node handle. Broadcasts blocks/txs; emits P2pEvent for incoming data.
/// Use `inert()` for tests when no Tokio runtime is available.
#[derive(Clone)]
pub struct P2pNode {
    broadcast_tx: Option<mpsc::Sender<BroadcastMsg>>,
    cmd_tx: Option<mpsc::Sender<Command>>,
}

impl P2pNode {
    /// Create a P2P node and spawn the swarm task.
    /// Returns the node handle and a receiver for incoming P2pEvent.
    /// When `block_provider` is provided, enables block request/response protocol.
    pub fn new(
        listen_addr: &str,
        block_provider: Option<Arc<dyn BlockProvider>>,
    ) -> Result<(Self, mpsc::Receiver<P2pEvent>), P2pError> {
        let (broadcast_tx, mut broadcast_rx) = mpsc::channel(64);
        let (cmd_tx, mut cmd_rx) = mpsc::channel(32);
        let (event_tx, event_rx) = mpsc::channel(64);

        let swarm = SwarmBuilder::with_new_identity()
            .with_tokio()
            .with_tcp(
                Default::default(),
                (libp2p::tls::Config::new, libp2p::noise::Config::new),
                libp2p::yamux::Config::default,
            )
            .map_err(|e| P2pError::Network(e.to_string()))?
            .with_behaviour(|key| {
                let gossipsub_config = gossipsub::ConfigBuilder::default()
                    .heartbeat_interval(Duration::from_secs(1))
                    .validation_mode(ValidationMode::Permissive)
                    .build()
                    .map_err(|e| Box::new(std::io::Error::other(e.to_string())))?;
                let gossipsub =
                    gossipsub::Behaviour::new(MessageAuthenticity::Signed(key.clone()), gossipsub_config)
                        .map_err(|e| Box::new(std::io::Error::other(e.to_string())))?;
                let block_sync = BlockSyncBehaviour::new(
                    [(StreamProtocol::new("/boing/block-sync/1"), ProtocolSupport::Full)],
                    request_response::Config::default(),
                );
                #[cfg(feature = "mdns")]
                {
                    let peer_id = key.public().to_peer_id();
                    let mdns = Mdns::new(libp2p::mdns::Config::default(), peer_id)
                        .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;
                    Ok::<_, Box<dyn std::error::Error + Send + Sync>>(BoingBehaviour {
                        mdns,
                        gossipsub,
                        block_sync,
                    })
                }
                #[cfg(not(feature = "mdns"))]
                Ok::<_, Box<dyn std::error::Error + Send + Sync>>(BoingBehaviour {
                    gossipsub,
                    block_sync,
                })
            })
            .map_err(|e| P2pError::Network(e.to_string()))?
            .with_swarm_config(|c| c.with_idle_connection_timeout(Duration::from_secs(60)))
            .build();

        let blocks_topic = IdentTopic::new(BLOCKS_TOPIC);
        let txs_topic = IdentTopic::new(TRANSACTIONS_TOPIC);
        let listen_addr = listen_addr.to_string();
        let block_provider = block_provider;

        tokio::spawn(async move {
            let mut swarm = swarm;
            let _ = swarm.listen_on(
                listen_addr
                    .parse()
                    .expect("valid listen address"),
            );
            swarm.behaviour_mut().gossipsub.subscribe(&blocks_topic).expect("subscribe blocks");
            swarm.behaviour_mut().gossipsub.subscribe(&txs_topic).expect("subscribe txs");

            info!("P2P: listening on {} peer_id={:?}", listen_addr, swarm.local_peer_id());

            loop {
                tokio::select! {
                    cmd = cmd_rx.recv() => {
                        match cmd {
                            Some(Command::RequestBlock(peer, req)) => {
                                swarm.behaviour_mut().block_sync.send_request(&peer, req);
                            }
                            Some(Command::GetPeers(tx)) => {
                                let peers: Vec<_> = swarm.connected_peers().cloned().collect();
                                let _ = tx.send(peers);
                            }
                            Some(Command::Dial(addr)) => {
                                if let Ok(ma) = addr.parse::<libp2p::Multiaddr>() {
                                    if let Err(e) = swarm.dial(ma) {
                                        warn!("P2P: dial {} failed: {:?}", addr, e);
                                    }
                                }
                            }
                            None => break,
                        }
                    }
                    msg = broadcast_rx.recv() => {
                        match msg {
                            Some(BroadcastMsg::Block(block)) => {
                                if let Err(e) = bincode::serialize(&block) {
                                    warn!("P2P: block serialize error: {}", e);
                                } else if let Ok(bytes) = bincode::serialize(&block) {
                                    if let Err(e) =
                                        swarm.behaviour_mut().gossipsub.publish(blocks_topic.clone(), bytes)
                                    {
                                        // Gossipsub returns InsufficientPeers when no remote peer has advertised
                                        // subscription to `boing/blocks` yet (common for a few heartbeats after
                                        // connect). Local consensus and RPC are unaffected.
                                        if matches!(e, PublishError::InsufficientPeers) {
                                            tracing::debug!(
                                                "P2P: block not gossip-published yet (InsufficientPeers); peers may still catch up via block-sync"
                                            );
                                        } else {
                                            warn!("P2P: block publish error: {}", e);
                                        }
                                    } else {
                                        info!("P2P: broadcast block height={}", block.header.height);
                                    }
                                }
                            }
                            Some(BroadcastMsg::Transaction(tx)) => {
                                if let Ok(bytes) = bincode::serialize(&tx) {
                                    if let Err(e) =
                                        swarm.behaviour_mut().gossipsub.publish(txs_topic.clone(), bytes)
                                    {
                                        if matches!(e, PublishError::InsufficientPeers) {
                                            tracing::debug!(
                                                "P2P: tx not gossip-published yet (InsufficientPeers)"
                                            );
                                        } else {
                                            warn!("P2P: tx publish error: {}", e);
                                        }
                                    } else {
                                        info!("P2P: broadcast tx from {:?}", tx.sender);
                                    }
                                }
                            }
                            None => break,
                        }
                    }
                    ev = swarm.select_next_some() => {
                        if let SwarmEvent::Behaviour(BoingBehaviourEvent::Gossipsub(gossipsub::Event::Message {
                                message, ..
                            })) = ev {
                            let topic = message.topic.as_str();
                            if topic == BLOCKS_TOPIC {
                                if let Ok(block) = bincode::deserialize(&message.data) {
                                    let _ = event_tx.send(P2pEvent::BlockReceived(block)).await;
                                }
                            } else if topic == TRANSACTIONS_TOPIC {
                                if let Ok(tx) = bincode::deserialize(&message.data) {
                                    let _ = event_tx.send(P2pEvent::TransactionReceived(tx)).await;
                                }
                            }
                        } else if let SwarmEvent::Behaviour(BoingBehaviourEvent::BlockSync(
                            request_response::Event::Message {
                                message: request_response::Message::Response { response, .. },
                                ..
                            },
                        )) = ev
                        {
                            if let Some(block) = response.0 {
                                let _ = event_tx.send(P2pEvent::BlockFetched(block)).await;
                            }
                        } else if let SwarmEvent::Behaviour(BoingBehaviourEvent::BlockSync(
                            request_response::Event::Message {
                                peer: _peer,
                                message: request_response::Message::Request { request, channel, .. },
                            },
                        )) = ev
                        {
                            if let Some(ref provider) = block_provider {
                                let block = match &request {
                                    BlockRequest::ByHash(h) => {
                                        let hash = Hash(*h);
                                        provider.get_block_by_hash(&hash)
                                    }
                                    BlockRequest::ByHeight(h) => provider.get_block_by_height(*h),
                                };
                                let resp = BlockResponse(block);
                                if let Err(e) = swarm.behaviour_mut().block_sync.send_response(channel, resp) {
                                    warn!("P2P: block response send error: {:?}", e);
                                }
                            }
                        } else if let SwarmEvent::NewListenAddr { address, .. } = ev {
                            info!("P2P: listening on {}", address);
                        }
                    }
                }
            }
        });

        Ok((
            Self {
                broadcast_tx: Some(broadcast_tx),
                cmd_tx: Some(cmd_tx),
            },
            event_rx,
        ))
    }

    /// Create an inert P2P node (no network). Use in tests without a Tokio runtime.
    pub fn inert() -> Self {
        Self {
            broadcast_tx: None,
            cmd_tx: None,
        }
    }

    /// Returns connected peers. For inert nodes, returns empty vec.
    pub async fn connected_peers(&self) -> Vec<libp2p::PeerId> {
        if let Some(ref ch) = self.cmd_tx {
            let (tx, rx) = oneshot::channel();
            if ch.send(Command::GetPeers(tx)).await.is_ok() {
                if let Ok(peers) = rx.await {
                    return peers;
                }
            }
        }
        vec![]
    }

    /// Dial a peer by multiaddress (e.g. "/ip4/127.0.0.1/tcp/4001").
    pub fn dial(&self, addr: &str) -> Result<(), P2pError> {
        if let Some(ref ch) = self.cmd_tx {
            ch.try_send(Command::Dial(addr.to_string()))
                .map_err(|e| P2pError::Network(e.to_string()))?;
        }
        Ok(())
    }

    /// Request a block from a peer. Response arrives via P2pEvent::BlockFetched.
    pub fn request_block(&self, peer: libp2p::PeerId, request: BlockRequest) -> Result<(), P2pError> {
        if let Some(ref ch) = self.cmd_tx {
            ch.try_send(Command::RequestBlock(peer, request))
                .map_err(|e| P2pError::Network(e.to_string()))?;
        }
        Ok(())
    }

    pub fn broadcast_block(&self, block: &Block) -> Result<(), P2pError> {
        if let Some(ref ch) = self.broadcast_tx {
            ch.try_send(BroadcastMsg::Block(block.clone()))
                .map_err(|e| P2pError::Network(e.to_string()))?;
        }
        Ok(())
    }

    pub fn broadcast_transaction(&self, tx: &Transaction) -> Result<(), P2pError> {
        if let Some(ref ch) = self.broadcast_tx {
            ch.try_send(BroadcastMsg::Transaction(tx.clone()))
                .map_err(|e| P2pError::Network(e.to_string()))?;
        }
        Ok(())
    }
}

impl Default for P2pNode {
    /// Default is inert (no network) for compatibility with tests.
    /// Use `P2pNode::new(addr)` for a live node.
    fn default() -> Self {
        Self::inert()
    }
}

#[derive(Debug, thiserror::Error)]
pub enum P2pError {
    #[error("Network error: {0}")]
    Network(String),
}
