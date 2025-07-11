import { ethers } from 'ethers'

// Contract configurations
export const CONTRACT_CONFIGS = {
  ethereum: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    symbol: 'ETH',
    rpcUrl: process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL || 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID',
    blockExplorer: 'https://etherscan.io',
    gasPrice: '20000000000',
    deploymentCost: '0.05'
  },
  sepolia: {
    chainId: 11155111,
    name: 'Sepolia Testnet',
    symbol: 'ETH',
    rpcUrl: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_PROJECT_ID',
    blockExplorer: 'https://sepolia.etherscan.io',
    gasPrice: '10000000000',
    deploymentCost: '0.01'
  },
  bsc: {
    chainId: 56,
    name: 'BNB Smart Chain',
    symbol: 'BNB',
    rpcUrl: 'https://bsc-dataseed1.binance.org/',
    blockExplorer: 'https://bscscan.com',
    gasPrice: '5000000000',
    deploymentCost: '0.01'
  },
  bscTestnet: {
    chainId: 97,
    name: 'BNB Smart Chain Testnet',
    symbol: 'BNB',
    rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
    blockExplorer: 'https://testnet.bscscan.com',
    gasPrice: '10000000000',
    deploymentCost: '0.01'
  },
  polygon: {
    chainId: 137,
    name: 'Polygon Mainnet',
    symbol: 'MATIC',
    rpcUrl: 'https://polygon-rpc.com/',
    blockExplorer: 'https://polygonscan.com',
    gasPrice: '30000000000',
    deploymentCost: '0.1'
  },
  polygonMumbai: {
    chainId: 80001,
    name: 'Polygon Mumbai',
    symbol: 'MATIC',
    rpcUrl: 'https://rpc-mumbai.maticvigil.com/',
    blockExplorer: 'https://mumbai.polygonscan.com',
    gasPrice: '30000000000',
    deploymentCost: '0.1'
  }
}

// Simplified contract ABIs
export const NFT_CERTIFICATE_ABI = [
  {
    "inputs": [
      {"internalType": "string", "name": "_name", "type": "string"},
      {"internalType": "string", "name": "_symbol", "type": "string"},
      {"internalType": "address", "name": "_owner", "type": "address"}
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "recipient", "type": "address"},
      {"internalType": "string", "name": "recipientName", "type": "string"},
      {"internalType": "string", "name": "courseName", "type": "string"},
      {"internalType": "string", "name": "metadataURI", "type": "string"}
    ],
    "name": "issueCertificate",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256"},
      {"indexed": true, "internalType": "address", "name": "recipient", "type": "address"},
      {"indexed": false, "internalType": "string", "name": "recipientName", "type": "string"},
      {"indexed": false, "internalType": "string", "name": "courseName", "type": "string"},
      {"indexed": false, "internalType": "string", "name": "metadataURI", "type": "string"}
    ],
    "name": "CertificateIssued",
    "type": "event"
  }
]

export const SBT_CERTIFICATE_ABI = NFT_CERTIFICATE_ABI // Same ABI for simplicity

// Simplified bytecode (you would need to compile and get actual bytecode)
export const NFT_CERTIFICATE_BYTECODE = "0x608060405234801561001057600080fd5b50..." // Your actual bytecode here
export const SBT_CERTIFICATE_BYTECODE = "0x608060405234801561001057600080fd5b50..." // Your actual bytecode here

export const TOKEN_TYPES = {
  NFT: {
    id: 'nft',
    name: 'NFT (Non-Fungible Token)',
    transferable: true,
    tradeable: true,
    description: 'Standard NFT that can be transferred and traded'
  },
  SBT: {
    id: 'sbt',
    name: 'SBT (Soulbound Token)',
    transferable: false,
    tradeable: false,
    description: 'Non-transferable token bound to the recipient\'s wallet'
  }
}

export interface DeploymentParams {
  name: string
  symbol: string
  tokenType: 'nft' | 'sbt'
  blockchain: string
  ownerAddress: string
}

export interface CertificateParams {
  contractAddress: string
  recipientAddress: string
  recipientName: string
  courseName: string
  metadataUri: string
  tokenType: 'nft' | 'sbt'
  blockchain: string
}

export class BlockchainService {
  private provider: ethers.BrowserProvider | null = null
  private signer: ethers.JsonRpcSigner | null = null

  constructor() {
    this.initializeProvider()
  }

  private async initializeProvider() {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      console.warn('No ethereum provider found in window')
      return
    }

    try {
      this.provider = new ethers.BrowserProvider((window as any).ethereum)
    } catch (error) {
      console.error('Failed to initialize provider:', error)
      throw error
    }
  }

  async getSigner(): Promise<ethers.JsonRpcSigner> {
    if (!this.provider) {
      throw new Error('No provider available')
    }

    try {
      return await this.provider.getSigner()
    } catch (error) {
      console.error('Failed to get signer:', error)
      throw error
    }
  }

  async deployContract(params: DeploymentParams): Promise<{ contractAddress: string; transactionHash: string; blockNumber: number }> {
    const { name, symbol, tokenType, blockchain, ownerAddress } = params

    try {
      const signer = await this.getSigner()
      const config = CONTRACT_CONFIGS[blockchain as keyof typeof CONTRACT_CONFIGS]
      
      if (!config) {
        throw new Error(`Unsupported blockchain: ${blockchain}`)
      }

      // Check if we're on the correct network
      const network = await this.provider!.getNetwork()
      if (Number(network.chainId) !== config.chainId) {
        await this.switchNetwork(blockchain)
      }

      // Get the appropriate ABI and bytecode based on token type
      const abi = tokenType === 'nft' ? NFT_CERTIFICATE_ABI : SBT_CERTIFICATE_ABI
      const bytecode = tokenType === 'nft' ? NFT_CERTIFICATE_BYTECODE : SBT_CERTIFICATE_BYTECODE

      // Create contract factory
      const contractFactory = new ethers.ContractFactory(abi, bytecode, signer)

      // Estimate gas
      const deployTransaction = await contractFactory.getDeployTransaction(name, symbol, ownerAddress)
      const estimatedGas = await this.provider!.estimateGas(deployTransaction)

      // Add 20% buffer to gas estimate
      const gasLimit = estimatedGas * 120n / 100n

      // Deploy contract
      const contract = await contractFactory.deploy(name, symbol, ownerAddress, {
        gasLimit,
        gasPrice: config.gasPrice
      })

      // Wait for deployment
      const deploymentTransaction = contract.deploymentTransaction()
      if (!deploymentTransaction) {
        throw new Error('No deployment transaction found')
      }

      const receipt = await deploymentTransaction.wait()
      
      if (!receipt) {
        throw new Error('Deployment transaction failed')
      }

      return {
        contractAddress: await contract.getAddress(),
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber
      }
    } catch (error) {
      console.error('Contract deployment error:', error)
      throw error
    }
  }

  async issueCertificate(params: CertificateParams): Promise<{ tokenId: string; transactionHash: string; blockNumber: number }> {
    const { contractAddress, recipientAddress, recipientName, courseName, metadataUri, tokenType } = params

    try {
      const signer = await this.getSigner()
      const abi = tokenType === 'nft' ? NFT_CERTIFICATE_ABI : SBT_CERTIFICATE_ABI
      
      const contract = new ethers.Contract(contractAddress, abi, signer)

      // Estimate gas
      const estimatedGas = await contract.issueCertificate.estimateGas(
        recipientAddress,
        recipientName,
        courseName,
        metadataUri
      )

      // Add 20% buffer
      const gasLimit = estimatedGas * 120n / 100n

      // Issue certificate
      const tx = await contract.issueCertificate(
        recipientAddress,
        recipientName,
        courseName,
        metadataUri,
        { gasLimit }
      )

      const receipt = await tx.wait()

      // Extract token ID from events
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = contract.interface.parseLog(log)
          return parsed && parsed.name === 'CertificateIssued'
        } catch (e) {
          return false
        }
      })

      let tokenId = '0'
      if (event) {
        const parsed = contract.interface.parseLog(event)
        tokenId = parsed?.args?.tokenId?.toString() || '0'
      }

      return {
        tokenId,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber
      }
    } catch (error) {
      console.error('Certificate issuance error:', error)
      throw error
    }
  }

  async switchNetwork(blockchain: string): Promise<void> {
    if (!this.provider || !(window as any).ethereum) {
      throw new Error('No wallet connected')
    }

    const config = CONTRACT_CONFIGS[blockchain as keyof typeof CONTRACT_CONFIGS]
    if (!config) {
      throw new Error('Unsupported network')
    }

    try {
      await (window as any).ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${config.chainId.toString(16)}` }],
      })
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await (window as any).ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${config.chainId.toString(16)}`,
                chainName: config.name,
                nativeCurrency: {
                  name: config.symbol,
                  symbol: config.symbol,
                  decimals: 18,
                },
                rpcUrls: [config.rpcUrl],
                blockExplorerUrls: [config.blockExplorer],
              },
            ],
          })
        } catch (addError) {
          throw new Error('Failed to add network to wallet')
        }
      } else {
        throw new Error('Failed to switch network')
      }
    }
  }

  async getBalance(address?: string): Promise<string> {
    if (!this.provider) {
      throw new Error('No provider available')
    }

    try {
      const targetAddress = address || await this.getAccount()
      if (!targetAddress) {
        throw new Error('No address provided')
      }

      const balance = await this.provider.getBalance(targetAddress)
      return ethers.formatEther(balance)
    } catch (error) {
      console.error('Failed to get balance:', error)
      throw error
    }
  }

  async getAccount(): Promise<string | null> {
    try {
      const signer = await this.getSigner()
      return await signer.getAddress()
    } catch (error) {
      console.error('Failed to get account:', error)
      return null
    }
  }

  getBlockExplorerUrl(blockchain: string, hash: string, type: 'tx' | 'address' = 'tx'): string {
    const config = CONTRACT_CONFIGS[blockchain as keyof typeof CONTRACT_CONFIGS]
    if (!config) return ''
    
    const path = type === 'tx' ? 'tx' : 'address'
    return `${config.blockExplorer}/${path}/${hash}`
  }

  getEstimatedCost(blockchain: string): string {
    const config = CONTRACT_CONFIGS[blockchain as keyof typeof CONTRACT_CONFIGS]
    return config?.deploymentCost || '0.01'
  }

  getSupportedTokenTypes(): typeof TOKEN_TYPES {
    return TOKEN_TYPES
  }
}

export const blockchainService = new BlockchainService()