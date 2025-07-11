import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { 
  Building, 
  Save, 
  Upload, 
  Trash2,
  Shield,
  ExternalLink,
  Copy,
  CheckCircle,
  Loader2,
  Globe,
  Mail,
  MapPin,
  AlertTriangle,
  Zap
} from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { useCompany } from '../hooks/useCompany'
import { useBlockchain } from '../hooks/useBlockchain'
import { useIPFS } from '../hooks/useIPFS'
import { useAccount, useNetwork } from 'wagmi'
import TokenTypeModal from '../components/TokenTypeModal'
import BlockchainSelector from '../components/BlockchainSelector'
import { blockchainService } from '../services/blockchain'
import toast from 'react-hot-toast'

interface CompanyForm {
  name: string
  description: string
  website: string
  email: string
  industry: string
  country: string
}

const CompanySettings: React.FC = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const { address } = useAccount()
  const { chain } = useNetwork()
  const { company, loading, saveCompany, setContractAddress } = useCompany()
  const { uploadFile, uploading } = useIPFS()
  const { deployContract, isDeploying, deploymentStatus } = useBlockchain()
  
  const [logo, setLogo] = useState<string>('')
  const [activeTab, setActiveTab] = useState('profile')
  const [showTokenTypeModal, setShowTokenTypeModal] = useState(false)
  const [selectedTokenType, setSelectedTokenType] = useState<'nft' | 'sbt'>('nft')
  const [selectedBlockchain, setSelectedBlockchain] = useState('sepolia')

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch
  } = useForm<CompanyForm>()

  const watchedName = watch('name')

  useEffect(() => {
    if (company) {
      setValue('name', company.name || '')
      setValue('description', company.description || '')
      setValue('website', company.website || '')
      setValue('email', company.email || '')
      setValue('industry', company.industry || '')
      setValue('country', company.country || '')
      setLogo(company.logo || '')
    }
  }, [company, setValue])

  const industries = [
    'Technology',
    'Education',
    'Healthcare',
    'Finance',
    'Manufacturing',
    'Retail',
    'Consulting',
    'Non-profit',
    'Government',
    'Other'
  ]

  const onSubmit = async (data: CompanyForm) => {
    try {
      await saveCompany({
        name: data.name,
        description: data.description,
        website: data.website,
        email: data.email,
        industry: data.industry,
        country: data.country,
        logo
      })
      toast.success(t('common.success'))
    } catch (error) {
      console.error('Save error:', error)
      toast.error(t('common.error'))
    }
  }

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      try {
        const result = await uploadFile(file)
        setLogo(result.url)
        toast.success(t('common.success'))
      } catch (error) {
        toast.error(t('common.error'))
      }
    }
  }

  const handleDeployContract = async () => {
    if (!watchedName) {
      toast.error('Le nom de l\'entreprise est requis')
      setActiveTab('profile')
      return
    }

    if (!address) {
      toast.error('Veuillez connecter votre wallet')
      return
    }

    try {
      const result = await deployContract(
        watchedName,
        company?.description || '',
        'CERT',
        selectedBlockchain,
        selectedTokenType
      )

      if (result) {
        // Save contract address to database
        await setContractAddress(result.contractAddress, result.transactionHash)
        setActiveTab('profile')
      }
    } catch (error: any) {
      console.error('Deploy error:', error)
      toast.error(error.message || 'Erreur lors du déploiement')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copié dans le presse-papiers')
  }

  const getBlockExplorerUrl = (hash: string) => {
    return blockchainService.getBlockExplorerUrl(company?.blockchain || 'sepolia', hash, 'address')
  }

  const tabs = [
    { id: 'profile', label: 'Profil', icon: <Building className="h-5 w-5" /> },
    { id: 'blockchain', label: 'Blockchain', icon: <Shield className="h-5 w-5" /> }
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Paramètres de l'entreprise
          </h1>
          <p className="text-gray-600">
            Configurez votre profil d'entreprise et déployez votre contrat intelligent
          </p>
        </motion.div>

        {/* Tabs */}
        <div className="mb-8">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-lg shadow-sm p-8"
          >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Logo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Logo
                </label>
                <div className="flex items-center space-x-6">
                  <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                    {logo ? (
                      <img src={logo} alt="Company logo" className="w-full h-full object-cover" />
                    ) : (
                      <Building className="h-8 w-8 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      id="logo-upload"
                      disabled={uploading}
                    />
                    <label
                      htmlFor="logo-upload"
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      <span>{uploading ? 'Chargement...' : 'Télécharger le logo'}</span>
                    </label>
                    {logo && (
                      <button
                        type="button"
                        onClick={() => setLogo('')}
                        className="ml-3 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nom de l'entreprise *
                  </label>
                  <input
                    {...register('name', { required: 'Le nom de l\'entreprise est requis' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nom de l'entreprise"
                  />
                  {errors.name && (
                    <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Industrie
                  </label>
                  <select 
                    {...register('industry')} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Sélectionner une industrie</option>
                    {industries.map(industry => (
                      <option key={industry} value={industry}>{industry}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Site web
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      {...register('website')}
                      type="url"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="https://your-company.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      {...register('email')}
                      type="email"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="contact@your-company.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pays
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      {...register('country')}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Pays"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  {...register('description')}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Description de l'entreprise"
                />
              </div>

              <div className="flex justify-end">
                <button 
                  type="submit" 
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Save className="h-4 w-4 mr-2" />
                  <span>Enregistrer</span>
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Blockchain Tab */}
        {activeTab === 'blockchain' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Contract Status */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Smart Contract</h3>
                  <p className="text-gray-600">Statut de votre contrat intelligent</p>
                </div>
                <div className="flex items-center space-x-2">
                  {company?.contractAddress ? (
                    <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1">
                      <CheckCircle className="h-4 w-4" />
                      <span>Déployé</span>
                    </div>
                  ) : (
                    <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                      Non déployé
                    </div>
                  )}
                </div>
              </div>

              {company?.contractAddress ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Adresse du contrat</p>
                      <p className="font-mono text-sm text-gray-900">{company.contractAddress}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => copyToClipboard(company.contractAddress!)}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors duration-200"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <a
                        href={getBlockExplorerUrl(company.contractAddress)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-purple-600 transition-colors duration-200"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Shield className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 mb-6">
                    Déployez votre contrat intelligent pour commencer à émettre des certificats
                  </p>
                  
                  {!watchedName && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                        <div>
                          <p className="text-sm font-medium text-yellow-800">
                            Configuration requise
                          </p>
                          <p className="text-sm text-yellow-700">
                            Veuillez d'abord configurer le nom de votre entreprise
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={() => setShowTokenTypeModal(true)}
                    disabled={!watchedName || isDeploying}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeploying ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Shield className="h-4 w-4 mr-2" />
                    )}
                    <span>{isDeploying ? 'Déploiement...' : 'Déployer le contrat'}</span>
                  </button>

                  {/* Deployment Status */}
                  {deploymentStatus && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800 font-medium">
                        {deploymentStatus}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Available Networks */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Réseaux disponibles
              </h3>
              <BlockchainSelector
                selectedBlockchain={selectedBlockchain}
                onSelect={setSelectedBlockchain}
                tokenType={selectedTokenType}
              />
            </div>
          </motion.div>
        )}

        {/* Token Type Modal */}
        <TokenTypeModal
          isOpen={showTokenTypeModal}
          onClose={() => setShowTokenTypeModal(false)}
          onSelect={(tokenType) => {
            setSelectedTokenType(tokenType)
            setShowTokenTypeModal(false)
            handleDeployContract()
          }}
          selectedType={selectedTokenType}
        />
      </div>
    </div>
  )
}

export default CompanySettings