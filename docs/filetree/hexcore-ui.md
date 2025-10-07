# File Tree: hexcore-ui

Generated on: 10/6/2025, 11:47:42 AM
Root path: `/Users/macbookpro/hdev/workspaces/blockchain/hydra-manager/hexcore-ui`

```
├── 📁 .data/ 🚫 (auto-hidden)
├── 📁 .git/ 🚫 (auto-hidden)
├── 📁 .nuxt/ 🚫 (auto-hidden)
├── 📁 .output/ 🚫 (auto-hidden)
├── 📁 __mocks__/
│   └── 📄 highlightjs-vue-mock.ts
├── 📁 assets/
│   ├── 📁 icons/
│   └── 📁 scss/
│       └── 🎨 index.scss
├── 📁 components/
│   ├── 📁 base/
│   │   ├── 🟢 BaseIcon.vue
│   │   ├── 🟢 BasePopup.vue
│   │   └── 🟢 BaseStatus.vue
│   ├── 📁 consumer/
│   │   ├── 🟢 ConsumerExpandRow.vue
│   │   ├── 🟢 ConsumerStatus.vue
│   │   └── 🟢 PopupSelectNode.vue
│   ├── 📁 layouts/
│   │   └── 🟢 Sidebar.vue
│   └── 📁 shared/
│       ├── 📁 PopupMonitorHydraNode/
│       │   ├── 🟢 TableRow.vue
│       │   └── 🟢 TableRowExpanded.vue
│       ├── 🟢 CounterCard.vue
│       ├── 🟢 HeadStats.vue
│       ├── 🟢 HydraHeadCard.client.vue
│       ├── 🟢 HydraNodeCard.vue
│       ├── 🟢 NodeTipInfo.vue
│       ├── 🟢 PopupCreateHydraHead.vue
│       ├── 🟢 PopupCreateHydraNode.vue
│       ├── 🟢 PopupCreateWalletAccount.vue
│       └── 🟢 PopupMonitorHydraNode.vue
├── 📁 composables/
│   └── 📄 usePopupState.ts
├── 📁 configs/
│   └── 📄 index.ts
├── 📁 constants/
│   └── 📄 chain.ts
├── 📁 interfaces/
│   ├── 📁 api/
│   │   ├── 📁 accounts/
│   │   │   ├── 📄 create.type.ts
│   │   │   └── 📄 list-account.type.ts
│   │   ├── 📁 consumer/
│   │   │   ├── 📄 consumer-info.type.ts
│   │   │   └── 📄 consumer.type.ts
│   │   ├── 📁 hydra-nodes/
│   │   │   ├── 📄 create.type.ts
│   │   │   ├── 📄 hydra-heads.type.ts
│   │   │   ├── 📄 hydra-node.type.ts
│   │   │   └── 📄 list.type.ts
│   │   ├── 📄 index.ts
│   │   ├── 📄 node-info.type.ts
│   │   └── 📄 response-factory.type.ts
│   ├── 📁 cardano/
│   │   ├── 📄 index.ts
│   │   └── 📄 utxo.type.ts
│   ├── 📁 hydra/
│   │   ├── 📄 payload.type.ts
│   │   ├── 📄 protocol-parameters.type.ts
│   │   └── 📄 transaction.type.ts
│   └── 📄 wallet-account.type.ts
├── 📁 layouts/
│   ├── 🟢 default.vue
│   └── 🟢 test.vue
├── 📁 lib/
│   └── 📁 hydra-wallet/
│       ├── 📁 constants/
│       │   ├── 📄 chain.ts
│       │   ├── 📄 index.ts
│       │   └── 📄 protocol-parameters.ts
│       ├── 📁 tests/
│       │   └── 📄 mock.ts
│       ├── 📁 types/
│       │   └── 📄 protocol.ts
│       ├── 📁 utils/
│       │   ├── 📁 cardano-wasm/
│       │   │   ├── 📄 build-keys.ts
│       │   │   ├── 📄 deserializer.ts
│       │   │   ├── 📄 index.ts
│       │   │   └── 📄 resolver.ts
│       │   └── 📄 parser.ts
│       ├── 📄 embedded.ts
│       └── 📄 index.ts
├── 📁 middleware/
│   └── 📄 auth.global.ts
├── 📁 node_modules/ 🚫 (auto-hidden)
├── 📁 pages/
│   ├── 🟢 consumers.vue
│   ├── 🟢 dashboard.vue
│   ├── 🟢 hydra-heads.vue
│   ├── 🟢 hydra-nodes.vue
│   ├── 🟢 index.vue
│   ├── 🟢 login.vue
│   ├── 🟢 settings.vue
│   ├── 🟢 test.vue
│   └── 🟢 wallet-accounts.vue
├── 📁 plugins/
│   ├── 📄 directives.client.ts
│   ├── 📄 highlight-js.client.ts
│   └── 📄 ofetch.ts
├── 📁 public/
│   ├── 📁 images/
│   │   ├── 🖼️ logo-hexcore-600x600.png
│   │   ├── 🖼️ logo-hexcore-600x600.webp
│   │   └── 🖼️ logo.png
│   ├── 🖼️ favicon.ico
│   └── 📄 robots.txt
├── 📁 server/
│   ├── 📁 api/
│   │   ├── 📁 accounts/
│   │   │   ├── 📁 utxo/
│   │   │   │   └── 📄 [address].get.ts
│   │   │   ├── 📄 create.post.ts
│   │   │   ├── 📄 list-accounts.get.ts
│   │   │   └── 📄 utxos.get.ts
│   │   ├── 📁 auth/
│   │   │   ├── 📄 index.get.ts
│   │   │   └── 📄 login.post.ts
│   │   ├── 📁 consumer/
│   │   │   ├── 📁 info/
│   │   │   │   ├── 📄 [id].get.ts
│   │   │   │   └── 📄 [id].put.ts
│   │   │   ├── 📄 list.get.ts
│   │   │   ├── 📄 remove-shared-node.post.ts
│   │   │   └── 📄 share-consumer-node.post.ts
│   │   ├── 📁 nodes/
│   │   │   ├── 📄 active-party.post.ts
│   │   │   ├── 📄 create-party.post.ts
│   │   │   ├── 📄 create.post.ts
│   │   │   ├── 📄 heads.ts
│   │   │   └── 📄 list.get.ts
│   │   ├── 📁 stats/
│   │   │   ├── 📄 explorer-heads.get.ts
│   │   │   └── 📄 heads.get.ts
│   │   ├── 📄 node-info.get.ts
│   │   └── 📄 test.get.ts
│   ├── 📁 data/
│   │   └── 📄 head-stats.json
│   ├── 📁 utils/
│   │   ├── 📄 axios.ts
│   │   ├── 📄 customize-error.ts
│   │   ├── 📄 errorHandler.ts
│   │   ├── 📄 getRequestAuthorization.ts
│   │   ├── 📄 requestHandler.ts
│   │   └── 📄 useValidator.ts
│   └── 📄 tsconfig.json
├── 📁 shared/
│   └── 📁 types/
│       ├── 📄 AddressesUtxoRes.type.ts
│       └── 📄 BigintWrap.type.ts
├── 📁 stores/
│   ├── 📄 account.ts
│   ├── 📄 auth.store.ts
│   ├── 📄 head-stats.store.ts
│   ├── 📄 hydra-monitoring.store.ts
│   ├── 📄 hydra-node.store.ts
│   └── 📄 main.ts
├── 📁 utils/
│   ├── 📁 cardano/
│   │   └── 📄 index.ts
│   ├── 📄 format.ts
│   ├── 📄 ogmios.ts
│   ├── 📄 resolverEndpoint.ts
│   └── 📄 useCopy.ts
├── 📄 .editorconfig
├── 🔒 .env 🚫 (auto-hidden)
├── 📄 .env.example 🚫 (auto-hidden)
├── 🚫 .gitignore
├── 📄 .npmrc
├── 📄 .prettierrc.json
├── 📖 README.md
├── 🟢 app.vue
├── 📄 eslint.config.mjs
├── 📄 nuxt.config.ts
├── 📄 package.json
├── ⚙️ pnpm-lock.yaml
├── 🐚 run.sh
├── 📄 tsconfig.json
├── 📄 uno.config.ts
└── 📄 vitest.config.ts
```

---
*Generated by FileTree Pro Extension*
