//! Multi-node testnet: 4 validators sync blocks via P2P.

use std::sync::Arc;
use std::time::Duration;

use boing_p2p::BlockRequest;
use boing_node::chain::ChainState;
use boing_node::node::BoingNode;
use rand::seq::SliceRandom;
use boing_primitives::{
    AccessList, Account, AccountId, AccountState, SignedTransaction, Transaction,
    TransactionPayload,
};
use boing_tokenomics::BLOCK_TIME_SECS;
use ed25519_dalek::SigningKey;
use rand::rngs::OsRng;
use tokio::sync::RwLock;

fn node_with_p2p_and_block_provider(
    signing_key: &SigningKey,
    balance: u128,
    p2p_listen: &str,
) -> (BoingNode, tokio::sync::mpsc::Receiver<boing_p2p::P2pEvent>) {
    let proposer = AccountId(signing_key.verifying_key().to_bytes());
    let genesis = ChainState::genesis(proposer);
    let chain = ChainState::from_genesis(genesis.clone());
    let chain_for_provider = chain.clone();
    let (p2p, event_rx) = boing_p2p::P2pNode::new(
        p2p_listen,
        Some(Arc::new(boing_node::ChainBlockProvider(chain_for_provider))),
    )
    .expect("P2P init");

    let mut consensus = boing_consensus::ConsensusEngine::single_validator(proposer);
    let _ = consensus.propose_and_commit(genesis);

    let mut state = boing_state::StateStore::new();
    state.insert(Account {
        id: proposer,
        state: AccountState { balance, nonce: 0, stake: 0 },
    });

    let node = BoingNode {
        chain,
        consensus,
        state,
        executor: boing_execution::BlockExecutor::new(),
        producer: boing_node::block_producer::BlockProducer::new(proposer).with_max_txs(100),
        vm: boing_execution::Vm::new(),
        scheduler: boing_execution::TransactionScheduler::new(),
        mempool: boing_node::mempool::Mempool::new(),
        p2p,
        dapp_registry: boing_node::dapp_registry::DappRegistry::new(),
        intent_pool: boing_node::intent_pool::IntentPool::new(),
        qa_pool: boing_node::node::pending_qa_pool_default(),
        persistence: None,
    };
    (node, event_rx)
}

#[tokio::test(flavor = "multi_thread")]
async fn test_four_validators_sync() {
    let key = SigningKey::generate(&mut OsRng);
    let proposer = AccountId(key.verifying_key().to_bytes());
    let to = AccountId([2u8; 32]);

    let base_port = 34011u16;
    let addrs: Vec<String> = (0..4)
        .map(|i| format!("/ip4/127.0.0.1/tcp/{}", base_port + i))
        .collect();

    let mut nodes_and_rx = Vec::new();
    for (i, addr) in addrs.iter().enumerate() {
        let (node, rx) = node_with_p2p_and_block_provider(&key, 1_000_000, addr);
        if i == 0 {
            let tx = Transaction {
                nonce: 0,
                sender: proposer,
                payload: TransactionPayload::Transfer { to, amount: 100 },
                access_list: AccessList::new(vec![proposer, to], vec![proposer, to]),
            };
            let signed = SignedTransaction::new(tx, &key);
            let _ = node.submit_transaction(signed);
        }
        nodes_and_rx.push((Arc::new(RwLock::new(node)), rx));
    }

    let boot_addr = addrs[0].clone();
    for (i, (node_ref, _rx)) in nodes_and_rx.iter().enumerate() {
        if i > 0 {
            node_ref.read().await.p2p.dial(&boot_addr).expect("dial");
        }
    }
    tokio::time::sleep(Duration::from_secs(2)).await;

    let node_refs: Vec<Arc<RwLock<BoingNode>>> =
        nodes_and_rx.iter().map(|(nr, _)| nr.clone()).collect();

    for (idx, (node_ref, mut rx)) in nodes_and_rx.into_iter().enumerate() {
        let sync_node_ref = node_ref.clone();
        if idx > 0 {
            let p2p = node_ref.read().await.p2p.clone();
            tokio::spawn(async move {
                let mut interval =
                    tokio::time::interval(Duration::from_secs(BLOCK_TIME_SECS));
                loop {
                    interval.tick().await;
                    let peers = p2p.connected_peers().await;
                    if let Some(peer) = peers.choose(&mut rand::rngs::OsRng) {
                        let h = sync_node_ref.read().await.chain.height();
                        let _ = p2p.request_block(*peer, BlockRequest::ByHeight(h + 1));
                    }
                }
            });
        }
        tokio::spawn(async move {
            while let Some(ev) = rx.recv().await {
                match ev {
                    boing_p2p::P2pEvent::BlockReceived(block)
                    | boing_p2p::P2pEvent::BlockFetched(block) => {
                        let mut n = node_ref.write().await;
                        if n.import_network_block(&block).is_ok() {
                            tracing::debug!("imported block height={}", block.header.height);
                        }
                    }
                    _ => {}
                }
            }
        });
    }

    let node0 = node_refs[0].clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(BLOCK_TIME_SECS));
        interval.tick().await;
        for _ in 0..4 {
            interval.tick().await;
            let mut node = node0.write().await;
            node.produce_block_if_ready();
        }
    });

    tokio::time::sleep(Duration::from_secs(BLOCK_TIME_SECS * 8 + 5)).await;

    let mut heights = Vec::new();
    for nr in &node_refs {
        heights.push(nr.read().await.chain.height());
    }

    assert!(
        heights[0] >= 1,
        "producer should have at least 1 block, got {:?}",
        heights
    );
    let max_h = heights.iter().max().copied().unwrap_or(0);
    let min_h = heights.iter().min().copied().unwrap_or(0);
    assert!(
        min_h >= 1,
        "all nodes should sync at least 1 block: heights {:?}",
        heights
    );
    assert!(
        max_h - min_h <= 1,
        "heights should be within 1: {:?}",
        heights
    );
}
