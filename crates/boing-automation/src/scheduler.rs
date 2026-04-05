//! Cron-style scheduler for recurring tasks.

use std::time::Duration;
use tokio::time::interval;

/// Simple cron expression: "every N seconds" or "at height % N == 0".
/// Extended: supports "every first block of hour" via block-height modulo.
#[derive(Clone, Debug)]
pub struct CronSchedule {
    /// Run every N seconds (0 = disabled).
    pub every_secs: u64,
    /// Or run when block_height % modulo == remainder.
    pub block_modulo: Option<(u64, u64)>,
}

impl CronSchedule {
    /// Every N seconds.
    pub fn every_secs(n: u64) -> Self {
        Self {
            every_secs: n,
            block_modulo: None,
        }
    }

    /// Every N blocks.
    pub fn every_blocks(n: u64) -> Self {
        Self {
            every_secs: 0,
            block_modulo: Some((n, 0)),
        }
    }

    /// Check if task should run at given block height and elapsed time.
    pub fn should_run(&self, block_height: u64, elapsed_secs: u64) -> bool {
        if self.every_secs > 0 && elapsed_secs > 0 && elapsed_secs.is_multiple_of(self.every_secs) {
            return true;
        }
        if let Some((modulo, remainder)) = self.block_modulo {
            if modulo > 0 && block_height % modulo == remainder {
                return true;
            }
        }
        false
    }
}

/// Scheduler — emits ticks for automation executors.
pub struct Scheduler {
    schedule: CronSchedule,
    tick_interval: Duration,
}

impl Scheduler {
    pub fn new(schedule: CronSchedule) -> Self {
        Self {
            schedule,
            tick_interval: Duration::from_secs(1),
        }
    }

    /// Run scheduler loop; calls `on_tick(block_height, elapsed_secs)` each tick.
    pub async fn run<F>(&self, mut on_tick: F)
    where
        F: FnMut(u64, u64),
    {
        let mut interval = interval(self.tick_interval);
        let mut elapsed = 0u64;
        let block_height = 0u64; // In real impl, fetch from chain

        loop {
            interval.tick().await;
            elapsed += 1;
            if self.schedule.should_run(block_height, elapsed) {
                tracing::info!(
                    target = "boing_automation::scheduler",
                    boing_component = "automation",
                    component_event = "scheduler_tick",
                    block_height = block_height,
                    elapsed_secs = elapsed,
                    "Scheduler tick"
                );
                on_tick(block_height, elapsed);
            }
        }
    }
}
