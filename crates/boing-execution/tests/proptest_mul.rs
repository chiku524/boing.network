//! Property tests: **Mul** (`0x03`) matches **256×256 → 256** (low limb) vs `num-bigint`.

use boing_execution::Interpreter;
use boing_primitives::{Account, AccountId, AccountState};
use boing_state::StateStore;
use num_bigint::BigUint;
use proptest::prelude::*;

const CONTRACT: AccountId = AccountId([2u8; 32]);

fn push32(w: &[u8; 32]) -> Vec<u8> {
    let mut v = vec![0x7f];
    v.extend_from_slice(w);
    v
}

fn mk_state() -> StateStore {
    let mut state = StateStore::new();
    state.insert(Account {
        id: CONTRACT,
        state: AccountState::default(),
    });
    state
}

fn expect_mul_low256(a: &[u8; 32], b: &[u8; 32]) -> [u8; 32] {
    let prod = BigUint::from_bytes_be(a) * BigUint::from_bytes_be(b);
    let bytes = prod.to_bytes_be();
    let mut out = [0u8; 32];
    if bytes.is_empty() {
        return out;
    }
    if bytes.len() <= 32 {
        out[32 - bytes.len()..].copy_from_slice(&bytes);
    } else {
        out.copy_from_slice(&bytes[bytes.len() - 32..]);
    }
    out
}

fn run_mul(a: [u8; 32], b: [u8; 32]) -> [u8; 32] {
    let mut code = push32(&a);
    code.extend(push32(&b));
    code.push(0x03);
    code.push(0x00);
    let mut it = Interpreter::new(code, 10_000_000);
    let mut state = mk_state();
    it.run(CONTRACT, CONTRACT, &[], &mut state).unwrap();
    assert_eq!(it.stack.len(), 1);
    it.stack[0]
}

proptest! {
    #[test]
    fn mul_matches_biguint_low256(a in prop::array::uniform32(0u8..=255), b in prop::array::uniform32(0u8..=255)) {
        let got = run_mul(a, b);
        let want = expect_mul_low256(&a, &b);
        prop_assert_eq!(got, want);
    }
}
