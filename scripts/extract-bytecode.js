const fs = require('fs');
const path = require('path');

async function extractBytecode() {
  try {
    console.log('🔍 Extraction du bytecode des contrats...');
    
    // Chemin vers les artifacts
    const artifactsPath = path.join(__dirname, '..', 'artifacts', 'contracts');
    
    // Lire le fichier CompanyCertificate
    const certificateArtifactPath = path.join(artifactsPath, 'CompanyCertificate.sol', 'CompanyCertificate.json');
    
    if (!fs.existsSync(certificateArtifactPath)) {
      console.error('❌ Artifact CompanyCertificate non trouvé. Compilez d\'abord les contrats avec: npx hardhat compile');
      return;
    }
    
    const certificateArtifact = JSON.parse(fs.readFileSync(certificateArtifactPath, 'utf8'));
    
    // Extraire le bytecode et l'ABI
    const bytecode = certificateArtifact.bytecode;
    const abi = certificateArtifact.abi;
    
    if (!bytecode || bytecode === '0x') {
      console.error('❌ Bytecode vide ou invalide');
      return;
    }
    
    console.log('✅ Bytecode extrait avec succès');
    console.log(`📏 Taille du bytecode: ${bytecode.length} caractères`);
    
    // Créer le fichier de configuration
    const contractData = {
      bytecode: bytecode,
      abi: abi,
      contractName: 'CompanyCertificate',
      extractedAt: new Date().toISOString()
    };
    
    // Sauvegarder dans src/config/
    const outputPath = path.join(__dirname, '..', 'src', 'config', 'contract-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(contractData, null, 2));
    
    console.log('✅ Données de contrat sauvegardées dans:', outputPath);
    
    // Mettre à jour le fichier blockchain.ts
    const blockchainServicePath = path.join(__dirname, '..', 'src', 'services', 'blockchain.ts');
    
    if (fs.existsSync(blockchainServicePath)) {
      let content = fs.readFileSync(blockchainServicePath, 'utf8');
      
      // Remplacer le bytecode placeholder
      const bytecodeRegex = /export const NFT_CERTIFICATE_BYTECODE = ".*"/;
      const newBytecode = `export const NFT_CERTIFICATE_BYTECODE = "${bytecode}"`;
      
      if (bytecodeRegex.test(content)) {
        content = content.replace(bytecodeRegex, newBytecode);
        fs.writeFileSync(blockchainServicePath, content);
        console.log('✅ Bytecode mis à jour dans blockchain.ts');
      }
    }
    
    console.log('\n🎉 Extraction terminée avec succès!');
    console.log('💡 Vous pouvez maintenant déployer vos contrats sans erreur de bytecode.');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'extraction:', error.message);
  }
}

extractBytecode();