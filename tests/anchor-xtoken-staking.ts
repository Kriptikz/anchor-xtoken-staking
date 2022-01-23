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

  // Mint A Decimals
  const MINT_A_DECIMALS = 6;

  // Initial Mint amount
  const MINT_A_AMOUNT = 10000 * 10 ** MINT_A_DECIMALS;

  // User Keypair
  const user1 = anchor.web3.Keypair.generate();
  const user2 = anchor.web3.Keypair.generate();
  const user3 = anchor.web3.Keypair.generate();
  const user4 = anchor.web3.Keypair.generate();
  const user5 = anchor.web3.Keypair.generate();


  // Payer Keypair
  const payer = anchor.web3.Keypair.generate();

  // Total amount staked by users
  let TOTAL_STAKE_VAULT_AMOUNT = 0;

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

  let user3TokenAAccount;
  let user3xTokenAAccount;

  let user4TokenAAccount;
  let user4xTokenAAccount;

  let user5TokenAAccount;
  let user5xTokenAAccount;

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
      MINT_A_DECIMALS,
      TOKEN_PROGRAM_ID,
    );

    // Create our users Token A Accounts
    user1TokenAAccount = await mintA.createAccount(user1.publicKey);
    user2TokenAAccount = await mintA.createAccount(user2.publicKey);
    user3TokenAAccount = await mintA.createAccount(user3.publicKey);
    user4TokenAAccount = await mintA.createAccount(user4.publicKey);
    user5TokenAAccount = await mintA.createAccount(user5.publicKey);


    // Mint some Token A to users
    await mintTokenAToUser(user1TokenAAccount, mintA, MINT_A_AMOUNT);
    await mintTokenAToUser(user2TokenAAccount, mintA, MINT_A_AMOUNT);
    await mintTokenAToUser(user3TokenAAccount, mintA, MINT_A_AMOUNT);
    await mintTokenAToUser(user4TokenAAccount, mintA, MINT_A_AMOUNT);
    await mintTokenAToUser(user5TokenAAccount, mintA, MINT_A_AMOUNT);

    // Verify we minted the correct amount for a user
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
    user2xTokenAAccount = await xMintA.createAccount(user2.publicKey)
    user3xTokenAAccount = await xMintA.createAccount(user3.publicKey)
    user4xTokenAAccount = await xMintA.createAccount(user4.publicKey)
    user5xTokenAAccount = await xMintA.createAccount(user5.publicKey)

    // Verity the Program owner of a users xToken Account is the Token Program
    let user1xTokenAAccountOwner = (await provider.connection.getAccountInfo(user1TokenAAccount)).owner;
    //console.log("User1 xToken Account Owner: ", user1xTokenAAccountOwner.toString());
    assert.equal(user1xTokenAAccountOwner.toString(), TOKEN_PROGRAM_ID.toString());
  });

  it('User1 Stakes 200 Tokens', async () => {
    await stakeTokens(user1, user1TokenAAccount, user1xTokenAAccount, 200);
  });

  it('100 Inflation Rewards Deposited to Stake Vault', async () => {
    await depositInflationRewards(100);
  });

  it('User2 Stakes 75 Tokens', async () => {
    await stakeTokens(user2, user2TokenAAccount, user2xTokenAAccount, 75);
  });

  it('User1 Unstakes 200 xTokens', async () => {
    await unstakeTokens(user1, user1TokenAAccount, user1xTokenAAccount, 200);
  });

  it('User3 Stakes 400 Tokens', async () => {
    await stakeTokens(user3, user3TokenAAccount, user3xTokenAAccount, 400);
  });

  it('User4 Stakes 600 Tokens', async () => {
    await stakeTokens(user4, user4TokenAAccount, user4xTokenAAccount, 600);
  });

  it('100 Inflation Rewards Deposited to Stake Vault', async () => {
    await depositInflationRewards(100);
  });

  it('User5 Stakes 300 Tokens', async () => {
    await stakeTokens(user5, user5TokenAAccount, user5xTokenAAccount, 300);
  });

  it('User4 Unstakes 350 xTokens', async () => {
    await unstakeTokens(user4, user4TokenAAccount, user4xTokenAAccount, 350);
  });


  // ------------------------------------------------------------------------------
  // |                          Utility Functions                                 |
  // ------------------------------------------------------------------------------

  async function mintTokenAToUser(userTokenAccount, mint, amount) {
    await mint.mintTo(
      userTokenAccount,
      payer.publicKey,
      [payer],
      amount,
    );
  }

  async function depositInflationRewards(amount) {
    const AMOUNT_TO_REWARD = amount * (10 ** MINT_A_DECIMALS);
    TOTAL_STAKE_VAULT_AMOUNT += AMOUNT_TO_REWARD;

    await mintA.mintTo(
      pdaStakeVaultTokenAAddress,
      payer.publicKey,
      [payer],
      AMOUNT_TO_REWARD,
    );
    
    // Get the amount of Tokens in the Stake Vault
    let pdaStakeVaultTokenAAmount = (await mintA.getAccountInfo(pdaStakeVaultTokenAAddress)).amount.toNumber();
    console.log("Stake Vault Amount: ", pdaStakeVaultTokenAAmount / (10 ** MINT_A_DECIMALS));
    assert.equal(pdaStakeVaultTokenAAmount, TOTAL_STAKE_VAULT_AMOUNT);
  }

  async function stakeTokens(user, userTokenAAccount, userxTokenAAccount, amount) {
    const AMOUNT_TO_STAKE_USER = amount * (10 ** MINT_A_DECIMALS);
    TOTAL_STAKE_VAULT_AMOUNT += AMOUNT_TO_STAKE_USER;

    // Calculate amount of xTokens they recieve for staking
    const TOTAL_STAKE_AMOUNT = (await mintA.getAccountInfo(pdaStakeVaultTokenAAddress)).amount.toNumber();
    const TOTAL_MINTED_XTOKENS = (await xMintA.getMintInfo()).supply.toNumber();
    let USER_X_TOKENS_FOR_STAKE = AMOUNT_TO_STAKE_USER;
    if (TOTAL_STAKE_AMOUNT != 0 && TOTAL_MINTED_XTOKENS != 0) {
     USER_X_TOKENS_FOR_STAKE = calculateXTokensForStake(AMOUNT_TO_STAKE_USER, TOTAL_STAKE_AMOUNT, TOTAL_MINTED_XTOKENS);
    };

    await provider.connection.confirmTransaction(
      await program.rpc.stake(
        pdaxMintABump,
        new anchor.BN(AMOUNT_TO_STAKE_USER),
        {
          accounts: {
            xMint: pdaxMintAAddress,
            mint: mintA.publicKey,
            staker: user.publicKey,
            stakerTokenAccount: userTokenAAccount,
            stakerXTokenAccount: userxTokenAAccount,
            stakeVault: pdaStakeVaultTokenAAddress,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
          signers: [user]
        }
      )
    );

    // Get the amount of xTokens in users xToken Account
    let userxTokenAAmount = (await xMintA.getAccountInfo(userxTokenAAccount)).amount.toNumber();
    console.log("User xToken Amount: ", userxTokenAAmount / (10 ** MINT_A_DECIMALS));
    assert.equal(userxTokenAAmount, USER_X_TOKENS_FOR_STAKE);

    // Get the amount of Tokens in the Stake Vault
    let pdaStakeVaultTokenAAmount = (await mintA.getAccountInfo(pdaStakeVaultTokenAAddress)).amount.toNumber();
    console.log("Stake Vault Token Amount: ", pdaStakeVaultTokenAAmount / (10 ** MINT_A_DECIMALS));
    assert.equal(pdaStakeVaultTokenAAmount, TOTAL_STAKE_VAULT_AMOUNT);

  }

  async function unstakeTokens(user, userTokenAAccount, userxTokenAAccount, amount) {
    const AMOUNT_TO_UNSTAKE_USER = amount * (10 ** MINT_A_DECIMALS);
    
    const USERS_X_TOKENS_LEFT = (await xMintA.getAccountInfo(userxTokenAAccount)).amount.toNumber() - AMOUNT_TO_UNSTAKE_USER;

    // Calculate amount of user1's Tokens they recieves for unstaking
    const TOTAL_STAKE_AMOUNT = (await mintA.getAccountInfo(pdaStakeVaultTokenAAddress)).amount.toNumber();
    const TOTAL_MINTED_XTOKENS = (await xMintA.getMintInfo()).supply.toNumber();
    TOTAL_STAKE_VAULT_AMOUNT -= calculateTokensForUnstake(AMOUNT_TO_UNSTAKE_USER, TOTAL_STAKE_AMOUNT, TOTAL_MINTED_XTOKENS);

    await provider.connection.confirmTransaction(
      await program.rpc.unstake(
        pdaStakeVaultTokenABump,
        new anchor.BN(AMOUNT_TO_UNSTAKE_USER),
        {
          accounts: {
            xMint: pdaxMintAAddress,
            mint: mintA.publicKey,
            staker: user.publicKey,
            stakerTokenAccount: userTokenAAccount,
            stakerXTokenAccount: userxTokenAAccount,
            stakeVault: pdaStakeVaultTokenAAddress,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
          signers: [user]
        }
      )
    );

    // Get the amount of xTokens in user's xToken Account
    let userxTokenAAmount = (await xMintA.getAccountInfo(userxTokenAAccount)).amount.toNumber();
    console.log("User1 xToken Amount: ", userxTokenAAmount / (10 ** MINT_A_DECIMALS));
    assert.equal(userxTokenAAmount, USERS_X_TOKENS_LEFT);

    // Get the amount of Tokens in the Stake Vault
    let pdaStakeVaultTokenAAmount = (await mintA.getAccountInfo(pdaStakeVaultTokenAAddress)).amount.toNumber();
    console.log("Stake Vault Token Amount: ", pdaStakeVaultTokenAAmount / (10 ** MINT_A_DECIMALS));
    assert.equal(pdaStakeVaultTokenAAmount, TOTAL_STAKE_VAULT_AMOUNT);
  }


  function calculateXTokensForStake(amountToStake, totalStakeAmount, totalMintedXTokens) {
    return Math.floor(amountToStake / (totalStakeAmount / totalMintedXTokens))
  }

  function calculateTokensForUnstake(amountToUnstake, totalStakeAmount, totalMintedXTokens) {
    return Math.floor(amountToUnstake * (totalStakeAmount / totalMintedXTokens))
  }
});
