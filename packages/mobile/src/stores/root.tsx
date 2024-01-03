import {APR_API_URL, CommunityChainInfoRepo, EmbedChainInfos} from '../config';

import {
  AccountStore,
  CosmosAccount,
  getKeplrFromWindow,
  QueriesStore,
  CosmosQueries,
  CoinGeckoPriceStore,
  CosmwasmQueries,
  SecretQueries,
  OsmosisQueries,
  ICNSQueries,
  SecretAccount,
  IBCChannelStore,
  IBCCurrencyRegistrar,
  QuerySharedContext,
  LSMCurrencyRegistrar,
  AgoricQueries,
} from '@keplr-wallet/stores';
import {
  ChainSuggestStore,
  InteractionStore,
  KeyRingStore,
  PermissionManagerStore,
  PermissionStore,
  SignInteractionStore,
  TokensStore,
} from '@keplr-wallet/stores-core';
import {AsyncKVStore} from '../common';
import {RNEnv, RNRouterUI, RNMessageRequesterInternal} from '../router';
import {APP_PORT} from '@keplr-wallet/router';
import EventEmitter from 'eventemitter3';
import {HugeQueriesStore} from './huge-queries';
import {ChainStore} from './chain';
import {FiatCurrency} from '@keplr-wallet/types';
import {UIConfigStore} from './ui-config';
import {
  ICNSInfo,
  CoinGeckoAPIEndPoint,
  CoinGeckoGetPrice,
  FiatCurrencies,
  TokenContractListURL,
  EthereumEndpoint,
} from '../config.ui';
import {TokenContractsQueries} from './token-contracts';
import {AprQueries} from './aprs';
import {CosmosGovernanceQueries} from './governance/quries';
import {CosmosGovernanceQueriesV1} from './governance/v1/quries';
import {ScamProposalStore} from './scam-proposal';
import {KeychainStore} from './keychain';
import {FavoriteWebpageStore} from './favorite';
import {WalletConnectStore} from './wallet-connect';
import {
  AxelarEVMBridgeCurrencyRegistrar,
  GravityBridgeCurrencyRegistrar,
  KeplrETCQueries,
} from '@keplr-wallet/stores-etc';
import {CheckVersionStore} from './version';

export class RootStore {
  public readonly keyRingStore: KeyRingStore;
  public readonly chainStore: ChainStore;
  public readonly ibcChannelStore: IBCChannelStore;

  public readonly permissionManagerStore: PermissionManagerStore;

  public readonly hugeQueriesStore: HugeQueriesStore;
  public readonly priceStore: CoinGeckoPriceStore;
  public readonly tokensStore: TokensStore;

  public readonly interactionStore: InteractionStore;
  public readonly permissionStore: PermissionStore;
  public readonly signInteractionStore: SignInteractionStore;
  public readonly chainSuggestStore: ChainSuggestStore;

  public readonly favoriteWebpageStore: FavoriteWebpageStore;

  public readonly queriesStore: QueriesStore<
    [
      AgoricQueries,
      CosmosQueries,
      CosmwasmQueries,
      SecretQueries,
      OsmosisQueries,
      KeplrETCQueries,
      ICNSQueries,
      TokenContractsQueries,
      AprQueries,
      CosmosGovernanceQueries,
      CosmosGovernanceQueriesV1,
    ]
  >;
  public readonly accountStore: AccountStore<[CosmosAccount, SecretAccount]>;
  public readonly uiConfigStore: UIConfigStore;

  public readonly ibcCurrencyRegistrar: IBCCurrencyRegistrar;
  public readonly lsmCurrencyRegistrar: LSMCurrencyRegistrar;
  public readonly gravityBridgeCurrencyRegistrar: GravityBridgeCurrencyRegistrar;
  public readonly axelarEVMBridgeCurrencyRegistrar: AxelarEVMBridgeCurrencyRegistrar;
  public readonly scamProposalStore: ScamProposalStore;
  public readonly checkUpdateStore: CheckVersionStore;

  public readonly keychainStore: KeychainStore;
  public readonly walletConnectStore: WalletConnectStore;

  constructor() {
    const router = new RNRouterUI(RNEnv.produceEnv);

    const eventEmitter = new EventEmitter();

    // Order is important.
    this.interactionStore = new InteractionStore(
      router,
      new RNMessageRequesterInternal(),
    );

    this.permissionManagerStore = new PermissionManagerStore(
      new RNMessageRequesterInternal(),
    );

    this.keyRingStore = new KeyRingStore(
      {
        dispatchEvent: (type: string) => {
          eventEmitter.emit(type);
        },
      },
      new RNMessageRequesterInternal(),
    );

    this.chainStore = new ChainStore(
      EmbedChainInfos,
      this.keyRingStore,
      new RNMessageRequesterInternal(),
    );

    this.ibcChannelStore = new IBCChannelStore(
      new AsyncKVStore('store_ibc_channel'),
      this.chainStore,
    );

    this.permissionStore = new PermissionStore(
      this.interactionStore,
      new RNMessageRequesterInternal(),
    );
    this.signInteractionStore = new SignInteractionStore(this.interactionStore);
    this.chainSuggestStore = new ChainSuggestStore(
      this.interactionStore,
      CommunityChainInfoRepo,
    );

    //FIXME - @keplr-wallet/stores를 최신 버전으로 업데이트를 해야함
    this.queriesStore = new QueriesStore(
      new AsyncKVStore('store_queries'),
      this.chainStore,
      {
        responseDebounceMs: 75,
      },
      AgoricQueries.use(),
      CosmosQueries.use(),
      CosmwasmQueries.use(),
      SecretQueries.use({
        apiGetter: getKeplrFromWindow,
      }),
      OsmosisQueries.use(),
      KeplrETCQueries.use({
        ethereumURL: EthereumEndpoint,
      }),
      ICNSQueries.use(),
      TokenContractsQueries.use({
        tokenContractListURL: TokenContractListURL,
      }),
      AprQueries.use({
        aprBaseUrl: APR_API_URL,
      }),
      CosmosGovernanceQueries.use(),
      CosmosGovernanceQueriesV1.use(),
    );

    this.accountStore = new AccountStore(
      {
        addEventListener: (type: string, fn: () => void) => {
          eventEmitter.addListener(type, fn);
        },
        removeEventListener: (type: string, fn: () => void) => {
          eventEmitter.removeListener(type, fn);
        },
      },
      this.chainStore,
      getKeplrFromWindow,
      () => {
        return {
          suggestChain: false,
          autoInit: true,
        };
      },
      CosmosAccount.use({
        queriesStore: this.queriesStore,
        msgOptsCreator: chainId => {
          // In certik, change the msg type of the MsgSend to "bank/MsgSend"
          if (chainId.startsWith('shentu-')) {
            return {
              send: {
                native: {
                  type: 'bank/MsgSend',
                },
              },
            };
          }

          // In akash or sifchain, increase the default gas for sending
          if (
            chainId.startsWith('akashnet-') ||
            chainId.startsWith('sifchain')
          ) {
            return {
              send: {
                native: {
                  gas: 120000,
                },
              },
            };
          }

          if (chainId.startsWith('secret-')) {
            return {
              send: {
                native: {
                  gas: 20000,
                },
              },
              withdrawRewards: {
                gas: 25000,
              },
            };
          }

          // For terra related chains
          if (
            chainId.startsWith('bombay-') ||
            chainId.startsWith('columbus-')
          ) {
            return {
              send: {
                native: {
                  type: 'bank/MsgSend',
                },
              },
              withdrawRewards: {
                type: 'distribution/MsgWithdrawDelegationReward',
              },
            };
          }

          if (chainId.startsWith('evmos_') || chainId.startsWith('planq_')) {
            return {
              send: {
                native: {
                  gas: 140000,
                },
              },
              withdrawRewards: {
                gas: 200000,
              },
            };
          }

          if (chainId.startsWith('osmosis')) {
            return {
              send: {
                native: {
                  gas: 100000,
                },
              },
              withdrawRewards: {
                gas: 300000,
              },
            };
          }

          if (chainId.startsWith('stargaze-')) {
            return {
              send: {
                native: {
                  gas: 100000,
                },
              },
              withdrawRewards: {
                gas: 200000,
              },
            };
          }
        },
      }),
      SecretAccount.use({
        queriesStore: this.queriesStore,
        msgOptsCreator: chainId => {
          if (chainId.startsWith('secret-')) {
            return {
              send: {
                secret20: {
                  gas: 175000,
                },
              },
              createSecret20ViewingKey: {
                gas: 175000,
              },
            };
          }
        },
      }),
    );

    this.priceStore = new CoinGeckoPriceStore(
      new AsyncKVStore('store_prices'),
      FiatCurrencies.reduce<{
        [vsCurrency: string]: FiatCurrency;
      }>((obj, fiat) => {
        obj[fiat.currency] = fiat;
        return obj;
      }, {}),
      'usd',
      {
        baseURL: CoinGeckoAPIEndPoint,
        uri: CoinGeckoGetPrice,
      },
    );

    this.hugeQueriesStore = new HugeQueriesStore(
      this.chainStore,
      this.queriesStore,
      this.accountStore,
      this.priceStore,
    );

    this.ibcCurrencyRegistrar = new IBCCurrencyRegistrar(
      new AsyncKVStore('store_ibc_curreny_registrar'),
      24 * 3600 * 1000,
      this.chainStore,
      this.accountStore,
      this.queriesStore,
    );
    this.lsmCurrencyRegistrar = new LSMCurrencyRegistrar(
      new AsyncKVStore('store_lsm_currency_registrar'),
      24 * 3600 * 1000,
      this.chainStore,
      this.queriesStore,
    );
    this.gravityBridgeCurrencyRegistrar = new GravityBridgeCurrencyRegistrar(
      new AsyncKVStore('store_gravity_bridge_currency_registrar'),
      24 * 3600 * 1000,
      this.chainStore,
      this.queriesStore,
    );
    this.axelarEVMBridgeCurrencyRegistrar =
      new AxelarEVMBridgeCurrencyRegistrar(
        new AsyncKVStore('store_axelar_evm_bridge_currency_registrar'),
        24 * 3600 * 1000,
        this.chainStore,
        this.queriesStore,
        'ethereum',
      );

    this.uiConfigStore = new UIConfigStore(
      {
        kvStore: new AsyncKVStore('store_ui_config'),
        addressBookKVStore: new AsyncKVStore('address_book'),
      },
      new RNMessageRequesterInternal(),
      this.chainStore,
      this.keyRingStore,
      this.priceStore,
      ICNSInfo,
    );

    this.tokensStore = new TokensStore(
      {
        addEventListener: (type: string, fn: () => void) => {
          eventEmitter.addListener(type, fn);
        },
      },
      new RNMessageRequesterInternal(),
      this.chainStore,
      this.accountStore,
      this.keyRingStore,
      this.interactionStore,
    );

    this.scamProposalStore = new ScamProposalStore(
      new QuerySharedContext(new AsyncKVStore('store_scam_proposal'), {
        responseDebounceMs: 100,
      }),
    );

    this.checkUpdateStore = new CheckVersionStore(
      new QuerySharedContext(new AsyncKVStore('store_app_version'), {
        responseDebounceMs: 100,
      }),
    );
    this.keychainStore = new KeychainStore(
      new AsyncKVStore('store_keychain'),
      this.keyRingStore,
    );

    this.favoriteWebpageStore = new FavoriteWebpageStore(
      new AsyncKVStore('store_favorite_url'),
    );

    this.walletConnectStore = new WalletConnectStore(
      new AsyncKVStore('store_wallet_connect_v2'),
      {
        addEventListener: (type: string, fn: () => void) => {
          eventEmitter.addListener(type, fn);
        },
        removeEventListener: (type: string, fn: () => void) => {
          eventEmitter.removeListener(type, fn);
        },
      },
      this.chainStore,
      this.keyRingStore,
      this.permissionStore,
      this.permissionManagerStore,
    );

    router.listen(APP_PORT);
  }
}

export function createRootStore() {
  return new RootStore();
}
