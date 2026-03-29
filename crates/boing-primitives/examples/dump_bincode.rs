//! One-off: print bincode bytes for TransactionPayload / AccessList (must match JS wallet).
use boing_primitives::{AccessList, AccountId, SignedTransaction, Transaction, TransactionPayload};
use ed25519_dalek::SigningKey;
use rand::rngs::OsRng;

fn main() {
    let id = AccountId::from_bytes([1u8; 32]);
    let transfer = TransactionPayload::Transfer { to: id, amount: 100 };
    let p = bincode::serialize(&transfer).unwrap();
    println!("Transfer: len={} hex={}", p.len(), hex::encode(&p));

    let call = TransactionPayload::ContractCall {
        contract: id,
        calldata: vec![1, 2, 3],
    };
    let p = bincode::serialize(&call).unwrap();
    println!("ContractCall: len={} hex={}", p.len(), hex::encode(&p));

    let deploy = TransactionPayload::ContractDeploy {
        bytecode: vec![0xde, 0xad],
    };
    let p = bincode::serialize(&deploy).unwrap();
    println!("ContractDeploy: len={} hex={}", p.len(), hex::encode(&p));

    let bond = TransactionPayload::Bond { amount: 1 };
    let p = bincode::serialize(&bond).unwrap();
    println!("Bond: len={} hex={}", p.len(), hex::encode(&p));

    let unbond = TransactionPayload::Unbond { amount: 2 };
    let p = bincode::serialize(&unbond).unwrap();
    println!("Unbond: len={} hex={}", p.len(), hex::encode(&p));

    let dwp = TransactionPayload::ContractDeployWithPurpose {
        bytecode: vec![0xab],
        purpose_category: "defi".to_string(),
        description_hash: Some(vec![0xcc; 32]),
    };
    let p = bincode::serialize(&dwp).unwrap();
    println!("DeployWithPurpose: len={} hex={}", p.len(), hex::encode(&p));

    let dwpm = TransactionPayload::ContractDeployWithPurposeAndMetadata {
        bytecode: vec![0xef],
        purpose_category: "meme".to_string(),
        description_hash: None,
        asset_name: Some("Token".to_string()),
        asset_symbol: Some("TKN".to_string()),
    };
    let p = bincode::serialize(&dwpm).unwrap();
    println!("DeployWithMeta: len={} hex={}", p.len(), hex::encode(&p));

    let al = AccessList::default();
    let a = bincode::serialize(&al).unwrap();
    println!("AccessList empty: len={} hex={}", a.len(), hex::encode(&a));

    let key = SigningKey::generate(&mut OsRng);
    let sender = AccountId::from_bytes(key.verifying_key().to_bytes());
    let tx = Transaction {
        nonce: 7,
        sender,
        payload: TransactionPayload::Transfer {
            to: AccountId::from_bytes([2u8; 32]),
            amount: 9,
        },
        access_list: AccessList::default(),
    };
    let signed = SignedTransaction::new(tx, &key);
    let s = bincode::serialize(&signed).unwrap();
    println!("SignedTransaction: len={} hex(first 80)={}", s.len(), hex::encode(&s[..80.min(s.len())]));

    let sig_only = bincode::serialize(&signed.signature).unwrap();
    println!("Signature alone: len={} hex={}", sig_only.len(), hex::encode(&sig_only));
}
