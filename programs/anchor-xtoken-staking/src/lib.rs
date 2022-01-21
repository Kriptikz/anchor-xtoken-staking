use anchor_lang::prelude::*;

declare_id!("9eQmoUcpxKDc6fLfVW6YtdsKXsmMcthWaq5D9iQjX6tw");

#[program]
pub mod anchor_xtoken_staking {
    use super::*;
    pub fn initialize(ctx: Context<Initialize>) -> ProgramResult {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
