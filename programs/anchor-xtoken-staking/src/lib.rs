use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};
use std::convert::TryInto;

declare_id!("9eQmoUcpxKDc6fLfVW6YtdsKXsmMcthWaq5D9iQjX6tw");

#[program]
pub mod anchor_xtoken_staking {
    use super::*;
    pub fn initialize_x_mint(_ctx: Context<InitializeXMint>) -> ProgramResult {
        Ok(())
    }

    pub fn stake(ctx: Context<Stake>, bump: u8, in_amount: u64) -> ProgramResult {
        let total_tokens = ctx.accounts.stake_vault.amount;
        let total_x_tokens = ctx.accounts.x_mint.supply;

        
        // Calculate the amount of xTokens to mint
        // amount = in_amount * total_x_tokens / total_tokens
        let amount;
        if total_tokens == 0 || total_x_tokens == 0 {
            amount = in_amount;
        } else {
            amount = (in_amount as u128).checked_mul(total_x_tokens as u128).unwrap()
                .checked_div(total_tokens as u128).unwrap()
                .try_into().unwrap();      
        }

        // Mint our xToken to the stakers xToken Account
        let mint_key = ctx.accounts.mint.key();
        let seeds = &[b"x-mint", mint_key.as_ref(), &[bump]];

        let signer = &[&seeds[..]];

        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::MintTo {
                mint: ctx.accounts.x_mint.to_account_info(),
                to: ctx.accounts.staker_x_token_account.to_account_info(),
                authority: ctx.accounts.x_mint.to_account_info(),
            },
            signer,
        );

        token::mint_to(cpi_context, amount)?;

        // Transfer Tokens to the Vault
        let cpi_context = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.staker_token_account.to_account_info(),
                to: ctx.accounts.stake_vault.to_account_info(),
                authority: ctx.accounts.staker.to_account_info(),
            }
        );

        token::transfer(cpi_context, in_amount)?;

        Ok(())
    }

    pub fn unstake(ctx: Context<Unstake>, bump: u8, in_amount: u64) -> ProgramResult {
        let total_tokens = ctx.accounts.stake_vault.amount;
        let total_x_tokens = ctx.accounts.x_mint.supply;

        // Burn xTokens used for unstake
        let cpi_context = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Burn {
                mint: ctx.accounts.x_mint.to_account_info(),
                to: ctx.accounts.staker_x_token_account.to_account_info(),
                authority: ctx.accounts.staker.to_account_info(),
            }
        );

        token::burn(cpi_context, in_amount)?;

        
        // Calculate the amount of Tokens to withdraw
        // amount = in_amount * total_tokens / total_x_tokens
        let amount;
        if total_tokens == 0 || total_x_tokens == 0 {
            amount = in_amount;
        } else {
            amount = (in_amount as u128).checked_mul(total_tokens as u128).unwrap()
                .checked_div(total_x_tokens as u128).unwrap()
                .try_into().unwrap();      
        }

        // Transfer Tokens from Vault
        let mint_key = ctx.accounts.mint.key();
        let seeds = &[b"stake-vault", mint_key.as_ref(), &[bump]];

        let signer = &[&seeds[..]];

        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.stake_vault.to_account_info(),
                to: ctx.accounts.staker_token_account.to_account_info(),
                authority: ctx.accounts.stake_vault.to_account_info(),
            },
            signer,
        );

        token::transfer(cpi_context, amount)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeXMint<'info> {
    #[account(init,
        payer = payer,
        mint::decimals = mint.decimals,
        mint::authority = x_mint,
        seeds = [b"x-mint", mint.key().as_ref()],
        bump,
    )]
    x_mint: Account<'info, Mint>,
    mint: Account<'info, Mint>,
    #[account(init,
        payer = payer,
        token::mint = mint,
        token::authority = stake_vault,
        seeds = [b"stake-vault", mint.key().as_ref()],
        bump,
    )]
    stake_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    payer: Signer<'info>,
    token_program: Program<'info, Token>,
    system_program: Program<'info, System>,
    rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct Stake<'info> {
    #[account(mut,
        seeds = [b"x-mint", mint.key().as_ref()],
        bump = bump)]
    x_mint: Account<'info, Mint>,
    mint: Account<'info, Mint>,
    staker: Signer<'info>,
    #[account(mut)]
    staker_token_account: Account<'info, TokenAccount>,
    #[account(mut, constraint = staker_x_token_account.owner == staker.key())]
    staker_x_token_account: Account<'info, TokenAccount>,
    #[account(mut,
        seeds = [b"stake-vault", mint.key().as_ref()],
        bump,)]
    stake_vault: Account<'info, TokenAccount>,
    token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct Unstake<'info> {
    #[account(mut,
        seeds = [b"x-mint", mint.key().as_ref()],
        bump,)]
    x_mint: Account<'info, Mint>,
    mint: Account<'info, Mint>,
    staker: Signer<'info>,
    #[account(mut)]
    staker_token_account: Account<'info, TokenAccount>,
    #[account(mut, constraint = staker_x_token_account.owner == staker.key())]
    staker_x_token_account: Account<'info, TokenAccount>,
    #[account(mut,
        seeds = [b"stake-vault", mint.key().as_ref()],
        bump = bump,)]
    stake_vault: Account<'info, TokenAccount>,
    token_program: Program<'info, Token>,
}
