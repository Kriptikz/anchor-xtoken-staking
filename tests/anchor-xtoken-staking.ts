import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { AnchorXtokenStaking } from '../target/types/anchor_xtoken_staking';
import { assert } from 'chai';

describe('anchor-xtoken-staking', () => {

  // Configure the client to use the local cluster.
  let provider = anchor.Provider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AnchorXtokenStaking as Program<AnchorXtokenStaking>;

  // Initial Mint amount
  const MINT_A_AMOUNT = 300;

  // Amount to Stake
  const AMOUNT_TO_STAKE_USER1 = 200;
  const AMOUNT_TO_STAKE_USER2 = 75;

  // Amount to Reward to stake pool
  const AMOUNT_TO_REWARD = 100;

  // User Keypair
  const user1 = anchor.web3.Keypair.generate();
  const user2 = anchor.web3.Keypair.generate();

  // Payer Keypair
  const payer = anchor.web3.Keypair.generate();

  // Main Token Mint Account
  let mintA;

  // xToken Mint PDA
  let pdaxMintAAddress;
  let pdaxMintABump;

  // xToken Mint Account
  let xMintA;

  // Associated Token Accounts for users
  let user1TokenAAccount;
  let user1xTokenAAccount;

  let user2TokenAAccount;
  let user2xTokenAAccount;

  // Program Token Stake Vault PDA
  let pdaStakeVaultTokenAAddress;
  let pdaStakeVaultTokenABump;


  it('Test Set Up', async () => {
    // Airdrop SOL to payer
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(payer.publicKey, anchor.web3.LAMPORTS_PER_SOL),
      "confirmed"
    );

    // Create our Token A Mint
    mintA = await Token.createMint(
      provider.connection,
      payer,
      payer.publicKey,
      null,
      6,
      TOKEN_PROGRAM_ID,
    );

    // Create our users Token A Accounts
    user1TokenAAccount = await mintA.createAccount(user1.publicKey);
    user2TokenAAccount = await mintA.createAccount(user2.publicKey);

    // Mint some Token A to users
    await mintA.mintTo(
      user1TokenAAccount,
      payer.publicKey,
      [payer],
      MINT_A_AMOUNT,
    );

    await mintA.mintTo(
      user2TokenAAccount,
      payer.publicKey,
      [payer],
      MINT_A_AMOUNT,
    );

    let user1TokenAAmount = (await mintA.getAccountInfo(user1TokenAAccount)).amount.toNumber();
    assert.equal(user1TokenAAmount, MINT_A_AMOUNT);

    // Find our Stake Vault PDA
    [pdaStakeVaultTokenAAddress, pdaStakeVaultTokenABump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("stake-vault"), mintA.publicKey.toBuffer()],
      program.programId,
    );

    // Find our xToken Mint PDA
    [pdaxMintAAddress, pdaxMintABump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("x-mint"), mintA.publicKey.toBuffer()],
      program.programId,
    );
  });

  it('Initialize xToken Mint', async () => {
    await provider.connection.confirmTransaction(
      await program.rpc.initializeXMint(
        {
          accounts: {
            xMint: pdaxMintAAddress,
            mint: mintA.publicKey,
            stakeVault: pdaStakeVaultTokenAAddress,
            payer: payer.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          },
          signers: [payer]
        }
      )
    );

    let pdaxMintAAddressOwner = (await provider.connection.getAccountInfo(pdaxMintAAddress)).owner;
    //console.log("xMint Owner: ", pdaxMintAAddressOwner.toString());
    assert.equal(pdaxMintAAddressOwner.toString(), TOKEN_PROGRAM_ID.toString());

    // Create our xMintA object from our initialized xMint Account
    xMintA = new Token(provider.connection, pdaxMintAAddress, TOKEN_PROGRAM_ID, payer);

    // Create our users xMintA Associated Token Account
    user1xTokenAAccount = await xMintA.createAccount(user1.publicKey)
    let user1xTokenAAccountOwner = (await provider.connection.getAccountInfo(user1TokenAAccount)).owner;
    //console.log("User1 xToken Account Owner: ", user1xTokenAAccountOwner.toString());
    assert.equal(user1xTokenAAccountOwner.toString(), TOKEN_PROGRAM_ID.toString());

    user2xTokenAAccount = await xMintA.createAccount(user2.publicKey)
    let user2xTokenAAccountOwner = (await provider.connection.getAccountInfo(user2TokenAAccount)).owner;
    //console.log("User2 xToken Account Owner: ", user1xTokenAAccountOwner.toString());
    assert.equal(user2xTokenAAccountOwner.toString(), TOKEN_PROGRAM_ID.toString());
  });

  it('Stake Tokens with User1', async () => {
    await provider.connection.confirmTransaction(
      await program.rpc.stake(
        pdaxMintABump,
        new anchor.BN(AMOUNT_TO_STAKE_USER1),
        {
          accounts: {
            xMint: pdaxMintAAddress,
            mint: mintA.publicKey,
            staker: user1.publicKey,
            stakerTokenAccount: user1TokenAAccount,
            stakerXTokenAccount: user1xTokenAAccount,
            stakeVault: pdaStakeVaultTokenAAddress,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
          signers: [user1]
        }
      )
    );

    // Get the amount of xTokens in user1's xToken Account
    let user1xTokenAAmount = (await xMintA.getAccountInfo(user1xTokenAAccount)).amount.toNumber();
    console.log("User1 xToken Amount: ", user1xTokenAAmount);
    assert.equal(user1xTokenAAmount, AMOUNT_TO_STAKE_USER1);

    // Get the amount of Tokens in the Stake Vault
    let pdaStakeVaultTokenAAmount = (await mintA.getAccountInfo(pdaStakeVaultTokenAAddress)).amount.toNumber();
    console.log("Stake Vault Token Amount: ", pdaStakeVaultTokenAAmount);
    assert.equal(pdaStakeVaultTokenAAmount, AMOUNT_TO_STAKE_USER1);

  });

  it('Deposit Rewards to Stake Vault', async () => {
    await mintA.mintTo(
      pdaStakeVaultTokenAAddress,
      payer.publicKey,
      [payer],
      AMOUNT_TO_REWARD,
    );
    
    // Get the amount of Tokens in the Stake Vault
    let pdaStakeVaultTokenAAmount = (await mintA.getAccountInfo(pdaStakeVaultTokenAAddress)).amount.toNumber();
    console.log("Stake Vault Amount: ", pdaStakeVaultTokenAAmount);
    assert.equal(pdaStakeVaultTokenAAmount, AMOUNT_TO_STAKE_USER1 + AMOUNT_TO_REWARD);

  });

  it('Stake Tokens with User2', async () => {
    // Calculate amount of user2's xTokens they recieve for staking
    const TOTAL_STAKE_AMOUNT = (await mintA.getAccountInfo(pdaStakeVaultTokenAAddress)).amount.toNumber();
    const TOTAL_MINTED_XTOKENS = (await xMintA.getMintInfo()).supply.toNumber();
    const USER2_X_TOKENS_FOR_STAKE = AMOUNT_TO_STAKE_USER2 / (TOTAL_STAKE_AMOUNT / TOTAL_MINTED_XTOKENS);

    await provider.connection.confirmTransaction(
      await program.rpc.stake(
        pdaxMintABump,
        new anchor.BN(AMOUNT_TO_STAKE_USER2),
        {
          accounts: {
            xMint: pdaxMintAAddress,
            mint: mintA.publicKey,
            staker: user2.publicKey,
            stakerTokenAccount: user2TokenAAccount,
            stakerXTokenAccount: user2xTokenAAccount,
            stakeVault: pdaStakeVaultTokenAAddress,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
          signers: [user2]
        }
      )
    );
    

    // Get the amount of xTokens in user1's xToken Account
    let user2xTokenAAmount = (await xMintA.getAccountInfo(user2xTokenAAccount)).amount.toNumber();
    console.log("User2 xToken Amount: ", user2xTokenAAmount);
    assert.equal(user2xTokenAAmount, USER2_X_TOKENS_FOR_STAKE);

    const AMOUNT_IN_STAKE_VAULT = AMOUNT_TO_STAKE_USER1 + AMOUNT_TO_STAKE_USER2 + AMOUNT_TO_REWARD;

    // Get the amount of Tokens in the Stake Vault
    let pdaStakeVaultTokenAAmount = (await mintA.getAccountInfo(pdaStakeVaultTokenAAddress)).amount.toNumber();
    console.log("Stake Vault Token Amount: ", pdaStakeVaultTokenAAmount);
    assert.equal(pdaStakeVaultTokenAAmount, AMOUNT_IN_STAKE_VAULT);

  });

  it('Unstake Tokens with User1', async () => {
    // Calculate amount of user1's Tokens they recieves for unstaking
    const TOTAL_STAKE_AMOUNT = (await mintA.getAccountInfo(pdaStakeVaultTokenAAddress)).amount.toNumber();
    const TOTAL_MINTED_XTOKENS = (await xMintA.getMintInfo()).supply.toNumber();
    const USER2_TOKEN_AMOUNT_WITHDRAWN = AMOUNT_TO_STAKE_USER1 * (TOTAL_STAKE_AMOUNT / TOTAL_MINTED_XTOKENS);

    await provider.connection.confirmTransaction(
      await program.rpc.unstake(
        pdaStakeVaultTokenABump,
        new anchor.BN(AMOUNT_TO_STAKE_USER1),
        {
          accounts: {
            xMint: pdaxMintAAddress,
            mint: mintA.publicKey,
            staker: user1.publicKey,
            stakerTokenAccount: user1TokenAAccount,
            stakerXTokenAccount: user1xTokenAAccount,
            stakeVault: pdaStakeVaultTokenAAddress,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
          signers: [user1]
        }
      )
    );

    // Get the amount of xTokens in user1's xToken Account
    let user1xTokenAAmount = (await xMintA.getAccountInfo(user1xTokenAAccount)).amount.toNumber();
    console.log("User1 xToken Amount: ", user1xTokenAAmount);
    assert.equal(user1xTokenAAmount, 0);

    // Get the amount of Tokens in the Stake Vault
    let pdaStakeVaultTokenAAmount = (await mintA.getAccountInfo(pdaStakeVaultTokenAAddress)).amount.toNumber();
    console.log("Stake Vault Token Amount: ", pdaStakeVaultTokenAAmount);
    assert.equal(pdaStakeVaultTokenAAmount, TOTAL_STAKE_AMOUNT - USER2_TOKEN_AMOUNT_WITHDRAWN);

  });

});
