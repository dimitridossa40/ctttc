// dynamicContractConfig.js
import { ethers } from 'ethers';
import * as solc from 'solc';

// Contract configurations for different blockchains
export const CONTRACT_CONFIGS = {
  ethereum: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    symbol: 'ETH',
    rpcUrl: 'https://mainnet.infura.io/v3/',
    blockExplorer: 'https://etherscan.io',
    gasPrice: '20000000000', // 20 gwei
    deploymentCost: '0.05' // ETH
  },
  sepolia: {
    chainId: 11155111,
    name: 'Sepolia Testnet',
    symbol: 'ETH',
    rpcUrl: 'https://sepolia.infura.io/v3/',
    blockExplorer: 'https://sepolia.etherscan.io',
    gasPrice: '10000000000', // 10 gwei
    deploymentCost: '0.01' // ETH
  },
  bsc: {
    chainId: 56,
    name: 'BNB Smart Chain',
    symbol: 'BNB',
    rpcUrl: 'https://bsc-dataseed1.binance.org/',
    blockExplorer: 'https://bscscan.com',
    gasPrice: '5000000000', // 5 gwei
    deploymentCost: '0.01' // BNB
  },
  polygon: {
    chainId: 137,
    name: 'Polygon Mainnet',
    symbol: 'MATIC',
    rpcUrl: 'https://polygon-rpc.com/',
    blockExplorer: 'https://polygonscan.com',
    gasPrice: '30000000000', // 30 gwei
    deploymentCost: '0.1' // MATIC
  }
};

// CORRECTION 1: Contrats Solidity simplifiés sans imports OpenZeppelin
export const CONTRACT_SOURCES = {
  NFTCertificate: `
    // SPDX-License-Identifier: MIT
    pragma solidity ^0.8.19;

    contract NFTCertificate {
        string public name;
        string public symbol;
        address public owner;
        uint256 private _tokenIds;
        
        struct Certificate {
            string recipientName;
            string courseName;
            uint256 issueDate;
            string metadataURI;
        }
        
        mapping(uint256 => address) public tokenOwner;
        mapping(uint256 => Certificate) public certificates;
        mapping(address => uint256) public ownerTokenCount;
        
        event CertificateIssued(
            uint256 indexed tokenId,
            address indexed recipient,
            string recipientName,
            string courseName,
            string metadataURI
        );
        
        modifier onlyOwner() {
            require(msg.sender == owner, "Not the owner");
            _;
        }
        
        constructor(
            string memory _name,
            string memory _symbol,
            address _owner
        ) {
            name = _name;
            symbol = _symbol;
            owner = _owner;
            _tokenIds = 0;
        }
        
        function issueCertificate(
            address recipient,
            string memory recipientName,
            string memory courseName,
            string memory metadataURI
        ) external onlyOwner returns (uint256) {
            _tokenIds++;
            uint256 tokenId = _tokenIds;
            
            tokenOwner[tokenId] = recipient;
            ownerTokenCount[recipient]++;
            
            certificates[tokenId] = Certificate({
                recipientName: recipientName,
                courseName: courseName,
                issueDate: block.timestamp,
                metadataURI: metadataURI
            });
            
            emit CertificateIssued(tokenId, recipient, recipientName, courseName, metadataURI);
            
            return tokenId;
        }
        
        function totalSupply() external view returns (uint256) {
            return _tokenIds;
        }
        
        function balanceOf(address account) external view returns (uint256) {
            return ownerTokenCount[account];
        }
        
        function ownerOf(uint256 tokenId) external view returns (address) {
            return tokenOwner[tokenId];
        }
    }
  `,
  
  SBTCertificate: `
    // SPDX-License-Identifier: MIT
    pragma solidity ^0.8.19;

    contract SBTCertificate {
        string public name;
        string public symbol;
        address public owner;
        uint256 private _tokenIds;
        
        struct Certificate {
            string recipientName;
            string courseName;
            uint256 issueDate;
            string metadataURI;
        }
        
        mapping(uint256 => address) public tokenOwner;
        mapping(uint256 => Certificate) public certificates;
        mapping(address => uint256) public ownerTokenCount;
        
        event CertificateIssued(
            uint256 indexed tokenId,
            address indexed recipient,
            string recipientName,
            string courseName,
            string metadataURI
        );
        
        modifier onlyOwner() {
            require(msg.sender == owner, "Not the owner");
            _;
        }
        
        constructor(
            string memory _name,
            string memory _symbol,
            address _owner
        ) {
            name = _name;
            symbol = _symbol;
            owner = _owner;
            _tokenIds = 0;
        }
        
        function issueCertificate(
            address recipient,
            string memory recipientName,
            string memory courseName,
            string memory metadataURI
        ) external onlyOwner returns (uint256) {
            _tokenIds++;
            uint256 tokenId = _tokenIds;
            
            tokenOwner[tokenId] = recipient;
            ownerTokenCount[recipient]++;
            
            certificates[tokenId] = Certificate({
                recipientName: recipientName,
                courseName: courseName,
                issueDate: block.timestamp,
                metadataURI: metadataURI
            });
            
            emit CertificateIssued(tokenId, recipient, recipientName, courseName, metadataURI);
            
            return tokenId;
        }
        
        function totalSupply() external view returns (uint256) {
            return _tokenIds;
        }
        
        function balanceOf(address account) external view returns (uint256) {
            return ownerTokenCount[account];
        }
        
        function ownerOf(uint256 tokenId) external view returns (address) {
            return tokenOwner[tokenId];
        }
    }
  `
};

// CORRECTION 2: Classe de compilation simplifiée
export class DynamicContractCompiler {
  constructor() {
    this.compiledContracts = new Map();
    this.solcVersion = '0.8.19';
  }

  async loadSolcCompiler() {
    try {
      // Utiliser une version stable de solc
      const solcSnapshot = await solc.loadRemoteVersion('v0.8.19+commit.7dd6d404');
      return solcSnapshot;
    } catch (error) {
      console.error('Failed to load Solc compiler:', error);
      throw new Error('Could not load Solidity compiler');
    }
  }

  async compileContract(contractName, contractSource) {
    try {
      // Vérifier le cache
      const cacheKey = `${contractName}_${this.solcVersion}`;
      if (this.compiledContracts.has(cacheKey)) {
        console.log(`Using cached compilation for ${contractName}`);
        return this.compiledContracts.get(cacheKey);
      }

      console.log(`Compiling contract ${contractName}...`);
      const solcCompiler = await this.loadSolcCompiler();

      const input = {
        language: 'Solidity',
        sources: {
          [`${contractName}.sol`]: {
            content: contractSource
          }
        },
        settings: {
          outputSelection: {
            '*': {
              '*': ['abi', 'evm.bytecode']
            }
          },
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      };

      const output = JSON.parse(solcCompiler.compile(JSON.stringify(input)));

      // CORRECTION 3: Meilleure gestion des erreurs
      if (output.errors) {
        const errors = output.errors.filter(error => error.severity === 'error');
        if (errors.length > 0) {
          console.error('Compilation errors:', errors);
          throw new Error(`Compilation errors: ${errors.map(e => e.formattedMessage).join('\n')}`);
        }
        
        // Afficher les warnings
        const warnings = output.errors.filter(error => error.severity === 'warning');
        if (warnings.length > 0) {
          console.warn('Compilation warnings:', warnings.map(w => w.formattedMessage).join('\n'));
        }
      }

      const contract = output.contracts[`${contractName}.sol`][contractName];
      
      if (!contract) {
        throw new Error(`Contract ${contractName} not found in compilation output`);
      }

      if (!contract.evm || !contract.evm.bytecode) {
        throw new Error(`Bytecode not generated for contract ${contractName}`);
      }

      const compilationResult = {
        bytecode: contract.evm.bytecode.object,
        abi: contract.abi,
        metadata: contract.metadata || '{}'
      };

      // CORRECTION 4: Validation du bytecode
      if (!compilationResult.bytecode || compilationResult.bytecode.length === 0) {
        throw new Error(`Empty bytecode generated for contract ${contractName}`);
      }

      // Mettre en cache
      this.compiledContracts.set(cacheKey, compilationResult);
      console.log(`Successfully compiled ${contractName} (${compilationResult.bytecode.length} bytes)`);

      return compilationResult;
    } catch (error) {
      console.error(`Failed to compile contract ${contractName}:`, error);
      throw error;
    }
  }

  async getContractABI(contractName) {
    const source = CONTRACT_SOURCES[contractName];
    if (!source) {
      throw new Error(`Contract source not found: ${contractName}`);
    }

    const compiled = await this.compileContract(contractName, source);
    return compiled.abi;
  }

  async getContractBytecode(contractName) {
    const source = CONTRACT_SOURCES[contractName];
    if (!source) {
      throw new Error(`Contract source not found: ${contractName}`);
    }

    const compiled = await this.compileContract(contractName, source);
    return compiled.bytecode;
  }
}

// CORRECTION 5: Gestionnaire de déploiement amélioré
export class ContractDeploymentManager {
  constructor() {
    this.compiler = new DynamicContractCompiler();
    this.deployedContracts = new Map();
  }

  validateBytecode(bytecode, contractName) {
    console.log(`Validating bytecode for ${contractName}...`);
    
    if (!bytecode) {
      throw new Error(`Bytecode is empty for contract: ${contractName}`);
    }
    
    // Convertir en string si nécessaire
    const bytecodeStr = bytecode.toString();
    
    // Ajouter le préfixe 0x si manquant
    const prefixedBytecode = bytecodeStr.startsWith('0x') ? bytecodeStr : `0x${bytecodeStr}`;
    
    // Vérifier le format hexadécimal
    if (!/^0x[a-fA-F0-9]*$/.test(prefixedBytecode)) {
      throw new Error(`Invalid bytecode format for ${contractName}: must be hexadecimal`);
    }
    
    // Vérifier que le bytecode n'est pas vide
    if (prefixedBytecode.length <= 2) {
      throw new Error(`Bytecode is too short for ${contractName}`);
    }
    
    console.log(`✓ Bytecode validated: ${prefixedBytecode.length} characters`);
    return prefixedBytecode;
  }

  async deployContract(provider, wallet, contractName, constructorArgs = [], options = {}) {
    try {
      console.log(`\n🚀 Starting deployment of ${contractName}...`);
      console.log(`Constructor args:`, constructorArgs);

      // Récupérer ABI et bytecode
      const abi = await this.compiler.getContractABI(contractName);
      const bytecode = await this.compiler.getContractBytecode(contractName);

      // Valider le bytecode
      const validBytecode = this.validateBytecode(bytecode, contractName);

      // CORRECTION 6: Créer le factory avec ethers v6
      const factory = new ethers.ContractFactory(abi, validBytecode, wallet);

      // Estimer le gas
      let gasLimit;
      try {
        const deployTransaction = await factory.getDeployTransaction(...constructorArgs);
        const gasEstimate = await provider.estimateGas({
          data: deployTransaction.data,
          from: wallet.address
        });
        
        // Ajouter 20% de marge
        gasLimit = (gasEstimate * 120n) / 100n;
        console.log(`⛽ Gas estimated: ${gasEstimate.toString()}, using: ${gasLimit.toString()}`);
      } catch (gasError) {
        console.warn('⚠️ Gas estimation failed, using default gas limit');
        gasLimit = 3000000n; // 3M gas par défaut
      }

      // Déployer le contrat
      const contract = await factory.deploy(...constructorArgs, {
        gasLimit: gasLimit,
        ...options
      });

      console.log(`📤 Transaction sent: ${contract.deploymentTransaction().hash}`);
      console.log(`⏳ Waiting for deployment...`);

      // Attendre le déploiement
      await contract.waitForDeployment();
      
      const contractAddress = await contract.getAddress();
      console.log(`✅ Contract deployed at: ${contractAddress}`);

      // Récupérer le reçu
      const receipt = await contract.deploymentTransaction().wait();
      console.log(`💰 Gas used: ${receipt.gasUsed.toString()}`);

      const deploymentResult = {
        contract,
        address: contractAddress,
        transactionHash: contract.deploymentTransaction().hash,
        receipt,
        abi,
        bytecode: validBytecode
      };

      // Mettre en cache
      this.deployedContracts.set(contractName, deploymentResult);

      return deploymentResult;
    } catch (error) {
      console.error(`❌ Contract deployment failed for ${contractName}:`, error.message);
      
      // Diagnostics détaillés
      if (error.code) {
        console.error(`Error code: ${error.code}`);
      }
      if (error.reason) {
        console.error(`Error reason: ${error.reason}`);
      }
      
      throw error;
    }
  }

  async deployNFTCertificate(provider, wallet, name, symbol, owner, options = {}) {
    return this.deployContract(
      provider,
      wallet,
      'NFTCertificate',
      [name, symbol, owner],
      options
    );
  }

  async deploySBTCertificate(provider, wallet, name, symbol, owner, options = {}) {
    return this.deployContract(
      provider,
      wallet,
      'SBTCertificate',
      [name, symbol, owner],
      options
    );
  }

  getDeployedContract(contractName) {
    return this.deployedContracts.get(contractName);
  }

  async getContractAt(contractName, address, signerOrProvider) {
    const abi = await this.compiler.getContractABI(contractName);
    return new ethers.Contract(address, abi, signerOrProvider);
  }
}

// Instance globale
export const deploymentManager = new ContractDeploymentManager();

// Configuration des types de tokens
export const TOKEN_TYPES = {
  NFT: {
    id: 'nft',
    name: 'NFT (Non-Fungible Token)',
    contractName: 'NFTCertificate',
    transferable: true,
    tradeable: true,
    description: 'Standard NFT that can be transferred and traded'
  },
  SBT: {
    id: 'sbt',
    name: 'SBT (Soulbound Token)',
    contractName: 'SBTCertificate',
    transferable: false,
    tradeable: false,
    description: 'Non-transferable token bound to the recipient\'s wallet'
  }
};

// Fonctions utilitaires
export const validateDeploymentConfig = (config) => {
  const requiredFields = ['chainId', 'name', 'symbol', 'rpcUrl'];
  const missingFields = requiredFields.filter(field => !config[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required configuration fields: ${missingFields.join(', ')}`);
  }
  
  return true;
};

export const getNetworkConfig = (networkName) => {
  const config = CONTRACT_CONFIGS[networkName];
  if (!config) {
    throw new Error(`Network configuration not found: ${networkName}`);
  }
  
  validateDeploymentConfig(config);
  return config;
};

// Export par défaut
export default {
  CONTRACT_CONFIGS,
  CONTRACT_SOURCES,
  DynamicContractCompiler,
  ContractDeploymentManager,
  deploymentManager,
  TOKEN_TYPES,
  validateDeploymentConfig,
  getNetworkConfig
};