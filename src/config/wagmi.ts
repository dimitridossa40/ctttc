// Version-compatible wagmi configuration
import { createConfig } from 'wagmi'
import { mainnet, sepolia, bsc, bscTestnet, polygon, polygonMumbai } from 'wagmi/chains'

// Get environment variables
const infuraProjectId = import.meta.env.VITE_INFURA_PROJECT_ID
const alchemyApiKey = import.meta.env.VITE_ALCHEMY_API_KEY
const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID

// Define chains
const chains = [mainnet, sepolia, bsc, bscTestnet, polygon, polygonMumbai]

// Check if we have a valid WalletConnect project ID
const hasValidWalletConnectId = walletConnectProjectId && 
  walletConnectProjectId !== '' && 
  walletConnectProjectId !== 'demo' &&
  walletConnectProjectId !== 'your_walletconnect_project_id'

// For wagmi v1 (your current version)
import { configureChains, createConfig as createConfigV1 } from 'wagmi'
import { publicProvider } from 'wagmi/providers/public'
import { infuraProvider } from 'wagmi/providers/infura'
import { alchemyProvider } from 'wagmi/providers/alchemy'
import { MetaMaskConnector } from 'wagmi/connectors/metaMask'
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect'
import { InjectedConnector } from 'wagmi/connectors/injected'
import { CoinbaseWalletConnector } from 'wagmi/connectors/coinbaseWallet'

// Configure providers based on available API keys
const providers = []

if (infuraProjectId && infuraProjectId !== '' && infuraProjectId !== 'demo') {
  providers.push(infuraProvider({ apiKey: infuraProjectId }))
}

if (alchemyApiKey && alchemyApiKey !== '' && alchemyApiKey !== 'demo') {
  providers.push(alchemyProvider({ apiKey: alchemyApiKey }))
}

// Always include public provider as fallback
providers.push(publicProvider())

const { chains: configuredChains, publicClient, webSocketPublicClient } = configureChains(
  chains,
  providers
)

// Configure connectors
const connectors = []

// Add MetaMask connector
connectors.push(new MetaMaskConnector({ chains: configuredChains }))

// Add injected connector for other wallets
connectors.push(new InjectedConnector({
  chains: configuredChains,
  options: {
    name: 'Injected',
    shimDisconnect: true,
  },
}))

// Add Coinbase Wallet connector
connectors.push(new CoinbaseWalletConnector({
  chains: configuredChains,
  options: {
    appName: 'CertifyWeb3',
  },
}))

// Add WalletConnect if we have a valid project ID
if (hasValidWalletConnectId) {
  try {
    connectors.push(new WalletConnectConnector({
      chains: configuredChains,
      options: {
        projectId: walletConnectProjectId,
        showQrModal: true,
        metadata: {
          name: 'CertifyWeb3',
          description: 'Blockchain Certificate Platform',
          url: 'https://certifyweb3.com',
          icons: ['https://certifyweb3.com/logo.png']
        }
      },
    }))
  } catch (error) {
    console.warn('⚠️ WalletConnect configuration failed:', error)
  }
} else {
  console.warn('⚠️ WalletConnect disabled: No valid project ID provided')
}

export const wagmiConfig = createConfigV1({
  autoConnect: true,
  connectors,
  publicClient,
  webSocketPublicClient,
})

export { configuredChains as chains }