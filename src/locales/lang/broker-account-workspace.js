const enUS = {
  'brokerAccounts.commandCenterTitle': 'Account Command Center',
  'brokerAccounts.commandCenterSubtitle': 'Manage trading connections and monitor account health from one workspace.',
  'brokerAccounts.connectionHealth': 'Connection health',
  'brokerAccounts.allHealthy': 'All connected accounts are healthy',
  'brokerAccounts.connections': 'Accounts & connections',
  'brokerAccounts.tradingAccounts': 'Broker accounts',
  'brokerAccounts.cryptoAccounts': 'Crypto exchanges',
  'brokerAccounts.addAccount': 'Add account',
  'brokerAccounts.addCryptoConnection': 'Add crypto exchange',
  'brokerAccounts.cryptoConnectionHint': 'Connect another venue and expand market coverage.',
  'brokerAccounts.connectedCount': '{count} connected'
}

const zhCN = {
  'brokerAccounts.commandCenterTitle': '账户指挥中心',
  'brokerAccounts.commandCenterSubtitle': '统一管理交易账户与连接，实时掌握账户健康和资金状态。',
  'brokerAccounts.connectionHealth': '整体连接状态',
  'brokerAccounts.allHealthy': '已连接账户全部正常',
  'brokerAccounts.connections': '账户与连接',
  'brokerAccounts.tradingAccounts': '交易账户',
  'brokerAccounts.cryptoAccounts': '加密交易所',
  'brokerAccounts.addAccount': '添加账户',
  'brokerAccounts.addCryptoConnection': '添加加密交易所',
  'brokerAccounts.cryptoConnectionHint': '连接更多交易所，覆盖全球市场。',
  'brokerAccounts.connectedCount': '已连接 {count} 个'
}

const zhTW = {
  'brokerAccounts.commandCenterTitle': '帳戶指揮中心',
  'brokerAccounts.commandCenterSubtitle': '統一管理交易帳戶與連線，即時掌握帳戶健康和資金狀態。',
  'brokerAccounts.connectionHealth': '整體連線狀態',
  'brokerAccounts.allHealthy': '已連線帳戶全部正常',
  'brokerAccounts.connections': '帳戶與連線',
  'brokerAccounts.tradingAccounts': '交易帳戶',
  'brokerAccounts.cryptoAccounts': '加密交易所',
  'brokerAccounts.addAccount': '新增帳戶',
  'brokerAccounts.addCryptoConnection': '新增加密交易所',
  'brokerAccounts.cryptoConnectionHint': '連接更多交易所，覆蓋全球市場。',
  'brokerAccounts.connectedCount': '已連線 {count} 個'
}

const locales = ['ar-SA', 'de-DE', 'fr-FR', 'ja-JP', 'ko-KR', 'ru-RU', 'th-TH', 'vi-VN']

export default locales.reduce((messages, locale) => {
  messages[locale] = { ...enUS }
  return messages
}, {
  'en-US': enUS,
  'zh-CN': zhCN,
  'zh-TW': zhTW
})
