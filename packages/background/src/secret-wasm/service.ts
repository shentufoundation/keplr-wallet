import { delay, inject, singleton } from "tsyringe";
import { TYPES } from "../types";

import { EnigmaUtils } from "secretjs";
import { KeyRingService } from "../keyring";
import { ChainsService } from "../chains";
import { PermissionService } from "../permission";
import { Hash } from "@keplr/crypto";
import { KVStore } from "@keplr/common";
import { ChainInfo } from "@keplr/types";
import { Bech32Address } from "@keplr/cosmos";
import { Env } from "@keplr/router";

import { Buffer } from "buffer/";

@singleton()
export class SecretWasmService {
  protected cacheEnigmaUtils: Map<string, EnigmaUtils> = new Map();

  constructor(
    @inject(TYPES.SecretWasmStore)
    protected readonly kvStore: KVStore,
    @inject(ChainsService)
    protected readonly chainsService: ChainsService,
    @inject(delay(() => KeyRingService))
    protected readonly keyRingService: KeyRingService,
    @inject(delay(() => PermissionService))
    public readonly permissionService: PermissionService
  ) {
    this.chainsService.addChainRemovedHandler(this.onChainRemoved);
  }

  protected readonly onChainRemoved = () => {
    this.cacheEnigmaUtils = new Map();
  };

  async getPubkey(env: Env, chainId: string): Promise<Uint8Array> {
    const chainInfo = await this.chainsService.getChainInfo(chainId);

    const keyRingType = await this.keyRingService.getKeyRingType();
    if (keyRingType === "none") {
      throw new Error("Key ring is not initialized");
    }

    const seed = await this.getSeed(env, chainInfo);

    const utils = this.getEnigmaUtils(chainInfo, seed);
    return utils.pubkey;
  }

  async encrypt(
    env: Env,
    chainId: string,
    contractCodeHash: string,
    // eslint-disable-next-line @typescript-eslint/ban-types
    msg: object
  ): Promise<Uint8Array> {
    const chainInfo = await this.chainsService.getChainInfo(chainId);

    const keyRingType = await this.keyRingService.getKeyRingType();
    if (keyRingType === "none") {
      throw new Error("Key ring is not initialized");
    }

    // XXX: Keplr should generate the seed deterministically according to the account.
    // Otherwise, it will lost the encryption/decryption key if Keplr is uninstalled or local storage is cleared.
    // For now, use the signature of some string to generate the seed.
    // It need to more research.
    const seed = await this.getSeed(env, chainInfo);

    const utils = this.getEnigmaUtils(chainInfo, seed);

    return await utils.encrypt(contractCodeHash, msg);
  }

  async decrypt(
    env: Env,
    chainId: string,
    ciphertext: Uint8Array,
    nonce: Uint8Array
  ): Promise<Uint8Array> {
    const chainInfo = await this.chainsService.getChainInfo(chainId);

    const keyRingType = await this.keyRingService.getKeyRingType();
    if (keyRingType === "none") {
      throw new Error("Key ring is not initialized");
    }

    // XXX: Keplr should generate the seed deterministically according to the account.
    // Otherwise, it will lost the encryption/decryption key if Keplr is uninstalled or local storage is cleared.
    // For now, use the signature of some string to generate the seed.
    // It need to more research.
    const seed = await this.getSeed(env, chainInfo);

    const utils = this.getEnigmaUtils(chainInfo, seed);

    return await utils.decrypt(ciphertext, nonce);
  }

  private getEnigmaUtils(chainInfo: ChainInfo, seed: Uint8Array): EnigmaUtils {
    const key = `${chainInfo.chainId}-${Buffer.from(seed).toString("hex")}`;

    if (this.cacheEnigmaUtils.has(key)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return this.cacheEnigmaUtils.get(key)!;
    }

    // TODO: Handle the rest config.
    const utils = new EnigmaUtils(chainInfo.rest, seed);
    this.cacheEnigmaUtils.set(key, utils);

    return utils;
  }

  private async getSeed(env: Env, chainInfo: ChainInfo): Promise<Uint8Array> {
    const key = await this.keyRingService.getKey(chainInfo.chainId);

    const storeKey = `seed-${chainInfo.chainId}-${new Bech32Address(
      key.address
    ).toBech32(chainInfo.bech32Config.bech32PrefixAccAddr)}`;

    const cached = await this.kvStore.get<string>(storeKey);
    if (cached) {
      return Buffer.from(cached, "hex");
    }

    const seed = Hash.sha256(
      Buffer.from(
        await this.keyRingService.sign(
          env,
          chainInfo.chainId,
          Buffer.from(
            JSON.stringify({
              account_number: 0,
              chain_id: chainInfo.chainId,
              fee: [],
              memo:
                "Create Keplr Secret encryption key. Only approve requests by Keplr.",
              msgs: [],
              sequence: 0,
            })
          )
        )
      )
    );

    await this.kvStore.set(storeKey, Buffer.from(seed).toString("hex"));

    return seed;
  }
}