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
  const MINT_A_AMOUNT = 1_000_000;

  // Amount to Stake
  const AMOUNT_TO_STAKE = 200;

  // Amount to Reward to stake pool
  const AMOUNT_TO_REWARD = 200;

  // User Keypair
  const user1 = anchor.web3.Keypair.generate();

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

    // Create our user1 Token A Account
    user1TokenAAccount = await mintA.createAccount(user1.publicKey);

    // Mint some Token A to user1TokenAAccount
    await mintA.mintTo(
      user1TokenAAccount,
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
  });

  it('Stake Tokens', async () => {
    
  });

});
