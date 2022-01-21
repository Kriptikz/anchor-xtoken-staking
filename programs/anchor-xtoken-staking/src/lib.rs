use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};

declare_id!("9eQmoUcpxKDc6fLfVW6YtdsKXsmMcthWaq5D9iQjX6tw");

#[program]
pub mod anchor_xtoken_staking {
    use super::*;
    pub fn initialize_x_mint(_ctx: Context<InitializeXMint>) -> ProgramResult {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeXMint<'info> {
    #[account(
        init,
        payer = payer,
        mint::decimals = mint.decimals,
        mint::authority = x_mint,
        seeds = [b"x-mint", mint.key().as_ref()],
        bump,
    )]
    x_mint: Account<'info, Mint>,
    mint: Account<'info, Mint>,
    #[account(mut)]
    payer: Signer<'info>,
    token_program: Program<'info, Token>,
    system_program: Program<'info, System>,
    rent: Sysvar<'info, Rent>,
}
