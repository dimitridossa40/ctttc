import { useState, useCallback } from 'react'
import { useAccount, useNetwork, useSwitchNetwork, useWalletClient } from 'wagmi'
import { blockchainService } from '../services/blockchain'
import { useAuthStore } from '../store/useAuthStore'
import toast from 'react-hot-toast'

export const useBlockchain = () => {
  const { address, isConnected } = useAccount()
  const { chain } = useNetwork()
  const { switchNetwork, isLoading: isSwitchingNetwork } = useSwitchNetwork()
  const { data: walletClient } = useWalletClient()
  const { user } = useAuthStore()
  const [isDeploying, setIsDeploying] = useState(false)
  const [isMinting, setIsMinting] = useState(false)
  const [deploymentStatus, setDeploymentStatus] = useState<string>('')

  const switchToNetwork = useCallback(async (targetChainId: number) => {
    if (!switchNetwork) {
      throw new Error('Network switching not available')
    }

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Network switch timeout'))
      }, 30000) // 30 seconds timeout

      switchNetwork(targetChainId, {
        onSuccess: () => {
          clearTimeout(timeout)
          console.log('✅ Network switched successfully')
          resolve()
        },
        onError: (error) => {
          clearTimeout(timeout)
          console.error('❌ Network switch failed:', error)
          reject(error)
        }
      })
    })
  }, [switchNetwork])

  const waitForNetworkChange = useCallback(async (targetChainId: number, maxRetries = 10) => {
    let retries = 0
    
    while (retries < maxRetries) {
      // Attendre un peu entre chaque vérification
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Vérifier si le réseau a changé
      if (chain?.id === targetChainId) {
        console.log('✅ Network change confirmed')
        return true
      }
      
      console.log(`⏳ Waiting for network change... (${retries + 1}/${maxRetries})`)
      retries++
    }
    
    throw new Error('Network change confirmation timeout')
  }, [chain?.id])

  const deployContract = async (
    companyName: string,
    description: string,
    symbol: string,
    blockchain: string,
    tokenType: 'nft' | 'sbt' = 'nft'
  ) => {
    if (!address || !isConnected) {
      toast.error('Veuillez connecter votre wallet')
      return null
    }

    try {
      setIsDeploying(true)
      setDeploymentStatus('Vérification du réseau...')
      
      // Switch to correct network if needed
      const targetChainId = getChainId(blockchain)
      console.log(`Current chain: ${chain?.id}, Target chain: ${targetChainId}`)
      
      if (chain?.id !== targetChainId) {
        setDeploymentStatus('Changement de réseau en cours...')
        
        try {
          // Effectuer le changement de réseau
          await switchToNetwork(targetChainId)
          
          // Attendre que le changement soit effectif
          await waitForNetworkChange(targetChainId)
          
          setDeploymentStatus('Réseau changé avec succès!')
          
          // Attendre un peu plus pour s'assurer que tout est synchronisé
          await new Promise(resolve => setTimeout(resolve, 2000))
        } catch (networkError: any) {
          console.error('Network switch error:', networkError)
          
          let errorMessage = 'Erreur lors du changement de réseau'
          if (networkError.message?.includes('User rejected') || networkError.message?.includes('denied')) {
            errorMessage = 'Changement de réseau refusé par l\'utilisateur'
          } else if (networkError.message?.includes('timeout')) {
            errorMessage = 'Timeout lors du changement de réseau'
          } else if (networkError.message) {
            errorMessage = networkError.message
          }
          
          throw new Error(errorMessage)
        }
      }

      setDeploymentStatus('Vérification du solde...')
      
      // Vérifier le solde
      const balance = await blockchainService.getBalance(address)
      const balanceNum = parseFloat(balance)
      
      if (balanceNum < 0.01) {
        throw new Error('Solde insuffisant pour le déploiement (minimum 0.01 ETH/BNB/MATIC requis)')
      }

      setDeploymentStatus('Compilation du contrat...')
      await new Promise(resolve => setTimeout(resolve, 1000))

      setDeploymentStatus('Déploiement du contrat...')
      
      // Déployer le contrat
      const result = await blockchainService.deployContract({
        name: companyName,
        symbol: symbol,
        tokenType: tokenType,
        blockchain: blockchain,
        ownerAddress: address
      })

      setDeploymentStatus('Contrat déployé avec succès!')
      
      toast.success(`Smart contract déployé avec succès!\nAdresse: ${result.contractAddress}`)
      
      return {
        contractAddress: result.contractAddress,
        transactionHash: result.transactionHash,
        blockchain,
        companyName,
        description,
        symbol,
        tokenType
      }
    } catch (error: any) {
      console.error('Deployment error:', error)
      
      let errorMessage = 'Erreur lors du déploiement'
      
      if (error.message?.includes('User rejected') || error.message?.includes('annulée')) {
        errorMessage = 'Transaction annulée par l\'utilisateur'
      } else if (error.message?.includes('insufficient funds') || error.message?.includes('Solde insuffisant')) {
        errorMessage = 'Fonds insuffisants pour le déploiement'
      } else if (error.message?.includes('gas')) {
        errorMessage = 'Erreur de gas - Ajustez le gas limit'
      } else if (error.message?.includes('réseau')) {
        errorMessage = error.message
      } else if (error.message) {
        errorMessage = error.message
      }
      
      setDeploymentStatus(`Erreur: ${errorMessage}`)
      toast.error(errorMessage)
      return null
    } finally {
      setIsDeploying(false)
      // Réinitialiser le statut après 5 secondes
      setTimeout(() => setDeploymentStatus(''), 5000)
    }
  }

  const mintCertificate = async (certificateData: {
    contractAddress: string
    recipientAddress: string
    recipientName: string
    courseName: string
    ipfsHash: string
    tokenType?: 'nft' | 'sbt'
    blockchain?: string
  }) => {
    if (!address) {
      toast.error('Veuillez connecter votre wallet')
      return null
    }

    if (!walletClient) {
      toast.error('Client wallet non disponible')
      return null
    }

    try {
      setIsMinting(true)
      
      const result = await blockchainService.issueCertificate({
        contractAddress: certificateData.contractAddress,
        recipientAddress: certificateData.recipientAddress,
        recipientName: certificateData.recipientName,
        courseName: certificateData.courseName,
        metadataUri: certificateData.ipfsHash,
        tokenType: certificateData.tokenType || 'nft',
        blockchain: certificateData.blockchain || 'sepolia'
      })
      
      toast.success(`Certificat minté avec succès!\nToken ID: ${result.tokenId}`)
      return result
    } catch (error: any) {
      console.error('Minting error:', error)
      
      let errorMessage = 'Erreur lors du mint'
      if (error.message?.includes('User rejected') || error.message?.includes('annulée')) {
        errorMessage = 'Transaction annulée par l\'utilisateur'
      } else if (error.message?.includes('insufficient funds')) {
        errorMessage = 'Fonds insuffisants pour le mint'
      } else if (error.message?.includes('not the owner') || error.message?.includes('not authorized')) {
        errorMessage = 'Vous n\'êtes pas autorisé à émettre des certificats sur ce contrat'
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast.error(errorMessage)
      return null
    } finally {
      setIsMinting(false)
    }
  }

  const getCertificate = async (contractAddress: string, tokenId: string) => {
    try {
      // This would need to be implemented based on your blockchain service
      // For now, return a mock response
      return {
        tokenId,
        contractAddress,
        recipientName: 'Unknown',
        courseName: 'Unknown',
        issueDate: new Date().toISOString()
      }
    } catch (error: any) {
      console.error('Get certificate error:', error)
      toast.error('Erreur lors de la récupération du certificat')
      return null
    }
  }

  const getBalance = async (address?: string) => {
    try {
      const balance = await blockchainService.getBalance(address)
      return balance
    } catch (error: any) {
      console.error('Get balance error:', error)
      return '0'
    }
  }

  const getBlockExplorerUrl = (blockchain: string, hash: string, type: 'tx' | 'address' = 'tx') => {
    return blockchainService.getBlockExplorerUrl(blockchain, hash, type)
  }

  const getChainId = (blockchain: string): number => {
    const chainIds: Record<string, number> = {
      ethereum: 1,
      sepolia: 11155111,
      bsc: 56,
      bscTestnet: 97,
      polygon: 137,
      polygonMumbai: 80001
    }
    return chainIds[blockchain] || 11155111 // Default to Sepolia
  }

  const getNetworkName = (chainId: number): string => {
    const networks: Record<number, string> = {
      1: 'Ethereum',
      11155111: 'Sepolia',
      56: 'BSC',
      97: 'BSC Testnet',
      137: 'Polygon',
      80001: 'Polygon Mumbai'
    }
    return networks[chainId] || 'Unknown'
  }

  return {
    // Méthodes de déploiement
    deployContract,
    
    // Méthodes pour les certificats
    mintCertificate,
    getCertificate,
    
    // Utilitaires
    getBalance,
    getBlockExplorerUrl,
    getNetworkName,
    
    // État
    isDeploying,
    isMinting,
    deploymentStatus,
    currentChain: chain,
    currentAddress: address,
    isSwitchingNetwork,
    
    // Actions
    switchNetwork,
    switchToNetwork
  }
}

