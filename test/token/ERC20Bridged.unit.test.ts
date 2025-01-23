import { assert } from "chai";
import hre from "hardhat";
import {
  ERC20Bridged__factory,
  OssifiableProxy__factory,
  AccountStub__factory,
} from "../../typechain";
import { unit } from "../../utils/testing";
import { wei } from "../../utils/wei";

unit("ERC20Bridged", ctxFactory)
  .test("bridge()", async (ctx) => {
    assert.equal(await ctx.erc20Bridged.bridge(), ctx.accounts.owner.address);
  })

  .test("totalSupply()", async (ctx) => {
    assert.equalBN(await ctx.erc20Bridged.totalSupply(), ctx.constants.premint);
  })

  .test("initialize() :: name already set", async (ctx) => {
    const { deployer, owner } = ctx.accounts;

    // deploy new implementation
    const erc20BridgedImpl = await new ERC20Bridged__factory(deployer).deploy(
      "Name",
      "",
      9,
      owner.address
    );
    await assert.revertsWith(
      erc20BridgedImpl.initialize("New Name", ""),
      "ErrorNameAlreadySet()"
    );
  })

  .test("initialize() :: symbol already set", async (ctx) => {
    const { deployer, owner } = ctx.accounts;

    // deploy new implementation
    const erc20BridgedImpl = await new ERC20Bridged__factory(deployer).deploy(
      "",
      "Symbol",
      9,
      owner.address
    );
    await assert.revertsWith(
      erc20BridgedImpl.initialize("", "New Symbol"),
      "ErrorSymbolAlreadySet()"
    );
  })

  .test("approve()", async (ctx) => {
    const { erc20Bridged } = ctx;
    const { holder, spender } = ctx.accounts;

    // validate initially allowance is zero
    assert.equalBN(
      await erc20Bridged.allowance(holder.address, spender.address),
      "0"
    );

    const amount = wei`1 ether`;

    // validate return value of the method
    assert.isTrue(
      await erc20Bridged.callStatic.approve(spender.address, amount)
    );

    // approve tokens
    const tx = await ctx.erc20Bridged.approve(spender.address, amount);

    // validate Approval event was emitted
    await assert.emits(ctx.erc20Bridged, tx, "Approval", [
      holder.address,
      spender.address,
      amount,
    ]);

    // validate allowance was set
    assert.equalBN(
      await ctx.erc20Bridged.allowance(holder.address, spender.address),
      amount
    );
  })

  .test("transfer() :: sender is zero address", async (ctx) => {
    const {
      accounts: { zero, recipient },
    } = ctx;
    await assert.revertsWith(
      ctx.erc20Bridged.connect(zero).transfer(recipient.address, wei`1 ether`),
      "ErrorAccountIsZeroAddress()"
    );
  })

  .test("transfer() :: recipient is zero address", async (ctx) => {
    const { zero, holder } = ctx.accounts;
    await assert.revertsWith(
      ctx.erc20Bridged.connect(holder).transfer(zero.address, wei`1 ether`),
      "ErrorAccountIsZeroAddress()"
    );
  })

  .test("transfer() :: zero balance", async (ctx) => {
    const { erc20Bridged } = ctx;
    const { premint } = ctx.constants;
    const { recipient, holder } = ctx.accounts;

    // validate balance before transfer
    assert.equalBN(await erc20Bridged.balanceOf(holder.address), premint);

    // transfer tokens
    await erc20Bridged.connect(holder).transfer(recipient.address, "0");

    // validate balance stays same
    assert.equalBN(await erc20Bridged.balanceOf(holder.address), premint);
  })

  .test("transfer() :: not enough balance", async (ctx) => {
    const { erc20Bridged } = ctx;
    const { premint } = ctx.constants;
    const { recipient, holder } = ctx.accounts;

    // validate balance before transfer
    assert.equalBN(await erc20Bridged.balanceOf(holder.address), premint);

    const amount = wei.toBigNumber(premint).add(wei`1 ether`);

    // transfer tokens
    await assert.revertsWith(
      erc20Bridged.connect(holder).transfer(recipient.address, amount),
      "ErrorNotEnoughBalance()"
    );
  })

  .test("transfer()", async (ctx) => {
    const { erc20Bridged } = ctx;
    const { premint } = ctx.constants;
    const { recipient, holder } = ctx.accounts;

    // validate balance before transfer
    assert.equalBN(await erc20Bridged.balanceOf(holder.address), premint);

    const amount = wei`1 ether`;

    // transfer tokens
    const tx = await erc20Bridged
      .connect(holder)
      .transfer(recipient.address, amount);

    // validate Transfer event was emitted
    await assert.emits(erc20Bridged, tx, "Transfer", [
      holder.address,
      recipient.address,
      amount,
    ]);

    // validate balance was updated
    assert.equalBN(
      await erc20Bridged.balanceOf(holder.address),
      wei.toBigNumber(premint).sub(amount)
    );

    // validate total supply stays same
    assert.equalBN(await erc20Bridged.totalSupply(), premint);
  })

  .test("transferFrom()", async (ctx) => {
    const { erc20Bridged } = ctx;
    const { premint } = ctx.constants;
    const { recipient, holder, spender } = ctx.accounts;

    const initialAllowance = wei`2 ether`;

    // holder sets allowance for spender
    await erc20Bridged.approve(spender.address, initialAllowance);

    // validate allowance is set
    assert.equalBN(
      await erc20Bridged.allowance(holder.address, spender.address),
      initialAllowance
    );

    // validate balance before transfer
    assert.equalBN(await erc20Bridged.balanceOf(holder.address), premint);

    const amount = wei`1 ether`;

    const holderBalanceBefore = await erc20Bridged.balanceOf(holder.address);

    // transfer tokens
    const tx = await erc20Bridged
      .connect(spender)
      .transferFrom(holder.address, recipient.address, amount);

    // validate Approval event was emitted
    await assert.emits(erc20Bridged, tx, "Approval", [
      holder.address,
      spender.address,
      wei.toBigNumber(initialAllowance).sub(amount),
    ]);

    // validate Transfer event was emitted
    await assert.emits(erc20Bridged, tx, "Transfer", [
      holder.address,
      recipient.address,
      amount,
    ]);

    // validate allowance updated
    assert.equalBN(
      await erc20Bridged.allowance(holder.address, spender.address),
      wei.toBigNumber(initialAllowance).sub(amount)
    );

    // validate holder balance updated
    assert.equalBN(
      await erc20Bridged.balanceOf(holder.address),
      holderBalanceBefore.sub(amount)
    );

    // validate recipient balance updated
    assert.equalBN(await erc20Bridged.balanceOf(recipient.address), amount);
  })

  .test("transferFrom() :: max allowance", async (ctx) => {
    const { erc20Bridged } = ctx;
    const { premint } = ctx.constants;
    const { recipient, holder, spender } = ctx.accounts;

    const initialAllowance = hre.ethers.constants.MaxUint256;

    // set allowance
    await erc20Bridged.approve(spender.address, initialAllowance);

    // validate allowance is set
    assert.equalBN(
      await erc20Bridged.allowance(holder.address, spender.address),
      initialAllowance
    );

    // validate balance before transfer
    assert.equalBN(await erc20Bridged.balanceOf(holder.address), premint);

    const amount = wei`1 ether`;

    const holderBalanceBefore = await erc20Bridged.balanceOf(holder.address);

    // transfer tokens
    const tx = await erc20Bridged
      .connect(spender)
      .transferFrom(holder.address, recipient.address, amount);

    // validate Approval event was not emitted
    await assert.notEmits(erc20Bridged, tx, "Approval");

    // validate Transfer event was emitted
    await assert.emits(erc20Bridged, tx, "Transfer", [
      holder.address,
      recipient.address,
      amount,
    ]);

    // validate allowance wasn't changed
    assert.equalBN(
      await erc20Bridged.allowance(holder.address, spender.address),
      initialAllowance
    );

    // validate holder balance updated
    assert.equalBN(
      await erc20Bridged.balanceOf(holder.address),
      holderBalanceBefore.sub(amount)
    );

    // validate recipient balance updated
    assert.equalBN(await erc20Bridged.balanceOf(recipient.address), amount);
  })

  .test("transferFrom() :: not enough allowance", async (ctx) => {
    const { erc20Bridged } = ctx;
    const { premint } = ctx.constants;
    const { recipient, holder, spender } = ctx.accounts;

    const initialAllowance = wei`0.9 ether`;

    // set allowance
    await erc20Bridged.approve(recipient.address, initialAllowance);

    // validate allowance is set
    assert.equalBN(
      await erc20Bridged.allowance(holder.address, recipient.address),
      initialAllowance
    );

    // validate balance before transfer
    assert.equalBN(await erc20Bridged.balanceOf(holder.address), premint);

    const amount = wei`1 ether`;

    // transfer tokens
    await assert.revertsWith(
      erc20Bridged
        .connect(spender)
        .transferFrom(holder.address, recipient.address, amount),
      "ErrorNotEnoughAllowance()"
    );
  })

  .test("increaseAllowance() :: initial allowance is zero", async (ctx) => {
    const { erc20Bridged } = ctx;
    const { holder, spender } = ctx.accounts;

    // validate allowance before increasing
    assert.equalBN(
      await erc20Bridged.allowance(holder.address, spender.address),
      "0"
    );

    const allowanceIncrease = wei`1 ether`;

    // increase allowance
    const tx = await erc20Bridged.increaseAllowance(
      spender.address,
      allowanceIncrease
    );

    // validate Approval event was emitted
    await assert.emits(erc20Bridged, tx, "Approval", [
      holder.address,
      spender.address,
      allowanceIncrease,
    ]);

    // validate allowance was updated correctly
    assert.equalBN(
      await erc20Bridged.allowance(holder.address, spender.address),
      allowanceIncrease
    );
  })

  .test("increaseAllowance() :: initial allowance is not zero", async (ctx) => {
    const { erc20Bridged } = ctx;
    const { holder, spender } = ctx.accounts;

    const initialAllowance = wei`2 ether`;

    // set initial allowance
    await erc20Bridged.approve(spender.address, initialAllowance);

    // validate allowance before increasing
    assert.equalBN(
      await erc20Bridged.allowance(holder.address, spender.address),
      initialAllowance
    );

    const allowanceIncrease = wei`1 ether`;

    // increase allowance
    const tx = await erc20Bridged.increaseAllowance(
      spender.address,
      allowanceIncrease
    );

    const expectedAllowance = wei
      .toBigNumber(initialAllowance)
      .add(allowanceIncrease);

    // validate Approval event was emitted
    await assert.emits(erc20Bridged, tx, "Approval", [
      holder.address,
      spender.address,
      expectedAllowance,
    ]);

    // validate allowance was updated correctly
    assert.equalBN(
      await erc20Bridged.allowance(holder.address, spender.address),
      expectedAllowance
    );
  })

  .test("increaseAllowance() :: the increase is not zero", async (ctx) => {
    const { erc20Bridged } = ctx;
    const { holder, spender } = ctx.accounts;

    const initialAllowance = wei`2 ether`;

    // set initial allowance
    await erc20Bridged.approve(spender.address, initialAllowance);

    // validate allowance before increasing
    assert.equalBN(
      await erc20Bridged.allowance(holder.address, spender.address),
      initialAllowance
    );

    // increase allowance
    const tx = await erc20Bridged.increaseAllowance(spender.address, "0");

    // validate Approval event was emitted
    await assert.emits(erc20Bridged, tx, "Approval", [
      holder.address,
      spender.address,
      initialAllowance,
    ]);

    // validate allowance was updated correctly
    assert.equalBN(
      await erc20Bridged.allowance(holder.address, spender.address),
      initialAllowance
    );
  })

  .test(
    "decreaseAllowance() :: decrease is greater than current allowance",
    async (ctx) => {
      const { erc20Bridged } = ctx;
      const { holder, spender } = ctx.accounts;

      // validate allowance before increasing
      assert.equalBN(
        await erc20Bridged.allowance(holder.address, spender.address),
        "0"
      );

      const allowanceDecrease = wei`1 ether`;

      // decrease allowance
      await assert.revertsWith(
        erc20Bridged.decreaseAllowance(spender.address, allowanceDecrease),
        "ErrorDecreasedAllowanceBelowZero()"
      );
    }
  )

  .group([wei`1 ether`, "0"], (allowanceDecrease) => [
    `decreaseAllowance() :: the decrease is ${allowanceDecrease} wei`,
    async (ctx) => {
      const { erc20Bridged } = ctx;
      const { holder, spender } = ctx.accounts;

      const initialAllowance = wei`2 ether`;

      // set initial allowance
      await erc20Bridged.approve(spender.address, initialAllowance);

      // validate allowance before increasing
      assert.equalBN(
        await erc20Bridged.allowance(holder.address, spender.address),
        initialAllowance
      );

      // decrease allowance
      const tx = await erc20Bridged.decreaseAllowance(
        spender.address,
        allowanceDecrease
      );

      const expectedAllowance = wei
        .toBigNumber(initialAllowance)
        .sub(allowanceDecrease);

      // validate Approval event was emitted
      await assert.emits(erc20Bridged, tx, "Approval", [
        holder.address,
        spender.address,
        expectedAllowance,
      ]);

      // validate allowance was updated correctly
      assert.equalBN(
        await erc20Bridged.allowance(holder.address, spender.address),
        expectedAllowance
      );
    },
  ])

  .test("permit()", async (ctx) => {
    const { erc20Bridged } = ctx;
    const { premint } = ctx.constants;
    const { recipient, holder } = ctx.accounts;

    // validate balance before permit
    assert.equalBN(await erc20Bridged.balanceOf(holder.address), premint);
    assert.equalBN(await erc20Bridged.balanceOf(recipient.address), 0);

    // validate allowance before permit
    assert.equalBN(await erc20Bridged.allowance(holder.address, recipient.address), 0);

    // amount that will be permitted
    const amount = wei`1 ether`;

    // get the nonce of the holder
    const nonce = await erc20Bridged.nonces(holder.address);

    // build deadline for the permit
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    // build the domain data for permit hash
    const domainData = {
      name: await erc20Bridged.name(),
      version: "1",
      chainId: (await hre.ethers.provider.getNetwork()).chainId,
      verifyingContract: erc20Bridged.address,
    };

    // build the types and values for permit hash
    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
    const value = {
      owner: holder.address,
      spender: recipient.address,
      value: amount,
      nonce,
      deadline,
    };

    // sign the permit hash
    const signature = await holder._signTypedData(domainData, types, value);

    // split the signature into its components
    const sig = hre.ethers.utils.splitSignature(signature);

    // perform the permit and ensure the allowance
    await erc20Bridged.permit(
      holder.address,
      recipient.address,
      amount,
      deadline,
      sig.v,
      sig.r,
      sig.s
    );
    assert.equalBN(await erc20Bridged.allowance(holder.address, recipient.address), wei.toBigNumber(amount));

    // ensure recipient can transfer the tokens, and that the balance is updated
    await erc20Bridged.connect(recipient).transferFrom(holder.address, recipient.address, amount);
    assert.equalBN(
      await erc20Bridged.balanceOf(recipient.address),
      wei.toBigNumber(amount)
    );
    assert.equalBN(
      await erc20Bridged.balanceOf(holder.address),
      wei.toBigNumber(premint).sub(amount)
    );
  })

  .test("permit() :: invalid signature", async (ctx) => {
    const { erc20Bridged } = ctx;
    const { premint } = ctx.constants;
    const { recipient, holder } = ctx.accounts;

    // amount that will be permitted
    const amount = wei`1 ether`;

    // get the nonce of the holder
    const nonce = await erc20Bridged.nonces(holder.address);

    // build deadline for the permit
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    // build the domain data for permit hash
    const domainData = {
      name: await erc20Bridged.name(),
      version: "1",
      chainId: (await hre.ethers.provider.getNetwork()).chainId,
      verifyingContract: erc20Bridged.address,
    };

    // build the types and values for permit hash
    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
    const value = {
      owner: holder.address,
      spender: recipient.address,
      value: amount,
      nonce,
      deadline,
    };

    // sign the permit hash
    const signature = await holder._signTypedData(domainData, types, value);

    // split the signature into its components
    const sig = hre.ethers.utils.splitSignature(signature);

    // make the signature invalid
    sig.r = hre.ethers.constants.HashZero;

    // try to perform the permit and ensure it reverts
    await assert.revertsWith(
      erc20Bridged.permit(
        holder.address,
        recipient.address,
        amount,
        deadline,
        sig.v,
        sig.r,
        sig.s
      ),
      "ERC20Permit: invalid signature"
    );
  })

  .test("permit() :: smart contract", async (ctx) => {
    const { erc20Bridged } = ctx;
    const { premint } = ctx.constants;
    const { recipient, holder, deployer } = ctx.accounts;
    const { accountStub } = ctx;

    // check owner of the account smart contract
    assert.equal(await accountStub.owner(), deployer.address);

    // amount that will be permitted
    const amount = wei`1 ether`;

    // transfer tokens
    const tx = await erc20Bridged.connect(holder).transfer(accountStub.address, amount);

    // validate balance before permit
    assert.equalBN(await erc20Bridged.balanceOf(accountStub.address), amount);
    assert.equalBN(await erc20Bridged.balanceOf(recipient.address), 0);

    // validate allowance before permit
    assert.equalBN(await erc20Bridged.allowance(accountStub.address, recipient.address), 0);

    // get the nonce of the accountStub
    const nonce = await erc20Bridged.nonces(accountStub.address);

    // build deadline for the permit
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    // build the domain data for permit hash
    const domainData = {
      name: await erc20Bridged.name(),
      version: "1",
      chainId: (await hre.ethers.provider.getNetwork()).chainId,
      verifyingContract: erc20Bridged.address,
    };

    // build the types and values for permit hash
    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
    const value = {
      owner: accountStub.address,
      spender: recipient.address,
      value: amount,
      nonce,
      deadline,
    };

    // sign the permit hash
    const signature = await deployer._signTypedData(domainData, types, value);

    // split the signature into its components
    const sig = hre.ethers.utils.splitSignature(signature);

    // perform the permit and ensure the allowance
    await erc20Bridged.permit(
      accountStub.address,
      recipient.address,
      amount,
      deadline,
      sig.v,
      sig.r,
      sig.s
    );
    assert.equalBN(await erc20Bridged.allowance(accountStub.address, recipient.address), wei.toBigNumber(amount));

    // ensure recipient can transfer the tokens, and that the balance is updated
    await erc20Bridged.connect(recipient).transferFrom(accountStub.address, recipient.address, amount);
    assert.equalBN(
      await erc20Bridged.balanceOf(recipient.address),
      wei.toBigNumber(amount)
    );
    assert.equalBN(
      await erc20Bridged.balanceOf(accountStub.address),
      0
    );
  })

  .test("permit() :: smart contract with invalid signature", async (ctx) => {
    const { erc20Bridged } = ctx;
    const { premint } = ctx.constants;
    const { recipient, holder, deployer } = ctx.accounts;
    const { accountStub } = ctx;

    // check owner of the account smart contract
    assert.equal(await accountStub.owner(), deployer.address);

    // amount that will be permitted
    const amount = wei`1 ether`;

    // get the nonce of the accountStub
    const nonce = await erc20Bridged.nonces(accountStub.address);

    // build deadline for the permit
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    // build the domain data for permit hash
    const domainData = {
      name: await erc20Bridged.name(),
      version: "1",
      chainId: (await hre.ethers.provider.getNetwork()).chainId,
      verifyingContract: erc20Bridged.address,
    };

    // build the types and values for permit hash
    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
    const value = {
      owner: accountStub.address,
      spender: recipient.address,
      value: amount,
      nonce,
      deadline,
    };

    // sign the permit hash
    const signature = await deployer._signTypedData(domainData, types, value);

    // split the signature into its components
    const sig = hre.ethers.utils.splitSignature(signature);

    // make the signature invalid
    sig.r = hre.ethers.constants.HashZero;

    // try to perform the permit and ensure it reverts
    await assert.revertsWith(
      erc20Bridged.permit(
        accountStub.address,
        recipient.address,
        amount,
        deadline,
        sig.v,
        sig.r,
        sig.s
      ),
      "ERC20Permit: invalid signature"
    );
  })

  .test("bridgeMint() :: not owner", async (ctx) => {
    const { erc20Bridged } = ctx;
    const { stranger } = ctx.accounts;

    await assert.revertsWith(
      erc20Bridged
        .connect(stranger)
        .bridgeMint(stranger.address, wei`1000 ether`),
      "ErrorNotBridge()"
    );
  })

  .group([wei`1000 ether`, "0"], (mintAmount) => [
    `bridgeMint() :: amount is ${mintAmount} wei`,
    async (ctx) => {
      const { erc20Bridged } = ctx;
      const { premint } = ctx.constants;
      const { recipient, owner } = ctx.accounts;

      // validate balance before mint
      assert.equalBN(await erc20Bridged.balanceOf(recipient.address), 0);

      // validate total supply before mint
      assert.equalBN(await erc20Bridged.totalSupply(), premint);

      // mint tokens
      const tx = await erc20Bridged
        .connect(owner)
        .bridgeMint(recipient.address, mintAmount);

      // validate Transfer event was emitted
      await assert.emits(erc20Bridged, tx, "Transfer", [
        hre.ethers.constants.AddressZero,
        recipient.address,
        mintAmount,
      ]);

      // validate balance was updated
      assert.equalBN(
        await erc20Bridged.balanceOf(recipient.address),
        mintAmount
      );

      // validate total supply was updated
      assert.equalBN(
        await erc20Bridged.totalSupply(),
        wei.toBigNumber(premint).add(mintAmount)
      );
    },
  ])

  .test("bridgeBurn() :: not owner", async (ctx) => {
    const { erc20Bridged } = ctx;
    const { holder, stranger } = ctx.accounts;

    await assert.revertsWith(
      erc20Bridged.connect(stranger).bridgeBurn(holder.address, wei`100 ether`),
      "ErrorNotBridge()"
    );
  })

  .test("bridgeBurn() :: amount exceeds balance", async (ctx) => {
    const { erc20Bridged } = ctx;
    const { owner, stranger } = ctx.accounts;

    // validate stranger has no tokens
    assert.equalBN(await erc20Bridged.balanceOf(stranger.address), 0);

    await assert.revertsWith(
      erc20Bridged.connect(owner).bridgeBurn(stranger.address, wei`100 ether`),
      "ErrorNotEnoughBalance()"
    );
  })

  .group([wei`10 ether`, "0"], (burnAmount) => [
    `bridgeBurn() :: amount is ${burnAmount} wei`,
    async (ctx) => {
      const { erc20Bridged } = ctx;
      const { premint } = ctx.constants;
      const { owner, holder } = ctx.accounts;

      // validate balance before mint
      assert.equalBN(await erc20Bridged.balanceOf(holder.address), premint);

      // validate total supply before mint
      assert.equalBN(await erc20Bridged.totalSupply(), premint);

      // burn tokens
      const tx = await erc20Bridged
        .connect(owner)
        .bridgeBurn(holder.address, burnAmount);

      // validate Transfer event was emitted
      await assert.emits(erc20Bridged, tx, "Transfer", [
        holder.address,
        hre.ethers.constants.AddressZero,
        burnAmount,
      ]);

      const expectedBalanceAndTotalSupply = wei
        .toBigNumber(premint)
        .sub(burnAmount);

      // validate balance was updated
      assert.equalBN(
        await erc20Bridged.balanceOf(holder.address),
        expectedBalanceAndTotalSupply
      );

      // validate total supply was updated
      assert.equalBN(
        await erc20Bridged.totalSupply(),
        expectedBalanceAndTotalSupply
      );
    },
  ])

  .run();

async function ctxFactory() {
  const name = "ERC20 Test Token";
  const symbol = "ERC20";
  const decimals = 18;
  const premint = wei`100 ether`;
  const [deployer, owner, recipient, spender, holder, stranger] =
    await hre.ethers.getSigners();
  const l2TokenImpl = await new ERC20Bridged__factory(deployer).deploy(
    name,
    symbol,
    decimals,
    owner.address
  );

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [hre.ethers.constants.AddressZero],
  });

  const zero = await hre.ethers.getSigner(hre.ethers.constants.AddressZero);

  const l2TokensProxy = await new OssifiableProxy__factory(deployer).deploy(
    l2TokenImpl.address,
    deployer.address,
    ERC20Bridged__factory.createInterface().encodeFunctionData("initialize", [
      name,
      symbol,
    ])
  );

  const erc20BridgedProxied = ERC20Bridged__factory.connect(
    l2TokensProxy.address,
    holder
  );

  await erc20BridgedProxied.connect(owner).bridgeMint(holder.address, premint);

  const accountStub = await new AccountStub__factory(deployer).deploy(
    deployer.address
  );

  return {
    accounts: { deployer, owner, recipient, spender, holder, zero, stranger },
    constants: { name, symbol, decimals, premint },
    erc20Bridged: erc20BridgedProxied,
    accountStub: accountStub,
  };
}
