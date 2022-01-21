import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { AnchorXtokenStaking } from '../target/types/anchor_xtoken_staking';

describe('anchor-xtoken-staking', () => {

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  const program = anchor.workspace.AnchorXtokenStaking as Program<AnchorXtokenStaking>;

  it('Is initialized!', async () => {
    // Add your test here.
    const tx = await program.rpc.initialize({});
    console.log("Your transaction signature", tx);
  });
});
