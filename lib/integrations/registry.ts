/**
 * Реестр доступных интеграций
 */

import { IntegrationProvider } from './types';

export const INTEGRATION_PROVIDERS: IntegrationProvider[] = [
  // ===== POS СИСТЕМЫ =====
  {
    type: 'pos',
    provider: 'iiko',
    name: 'iiko',
    description: 'Популярная POS-система для ресторанов. Синхронизация меню и отправка заказов в кассу.',
    logo: '/integrations/iiko.png',
    docsUrl: 'https://api.iiko.ru/',
    supportedEvents: ['menu.sync', 'order.created', 'order.paid'],
    configSchema: [
      { key: 'apiLogin', label: 'API Login', type: 'text', required: true },
      { key: 'organizationId', label: 'ID организации', type: 'text', required: true },
      { key: 'terminalGroupId', label: 'ID терминала', type: 'text', required: true },
    ],
  },
  {
    type: 'pos',
    provider: 'rkeeper',
    name: 'R-Keeper',
    description: 'Система автоматизации ресторанов UCS. Интеграция с кассой и меню.',
    logo: '/integrations/rkeeper.png',
    docsUrl: 'https://support.ucs.ru/',
    supportedEvents: ['menu.sync', 'order.created'],
    configSchema: [
      { key: 'serverUrl', label: 'URL сервера', type: 'text', required: true },
      { key: 'username', label: 'Имя пользователя', type: 'text', required: true },
      { key: 'password', label: 'Пароль', type: 'password', required: true },
      { key: 'stationId', label: 'ID станции', type: 'text', required: true },
    ],
  },
  {
    type: 'pos',
    provider: 'poster',
    name: 'Poster POS',
    description: 'Облачная POS-система для кафе и ресторанов.',
    logo: '/integrations/poster.png',
    docsUrl: 'https://dev.joinposter.com/',
    supportedEvents: ['menu.sync', 'order.created', 'order.paid'],
    configSchema: [
      { key: 'accessToken', label: 'Access Token', type: 'password', required: true },
      { key: 'accountName', label: 'Имя аккаунта', type: 'text', required: true },
    ],
  },
  {
    type: 'pos',
    provider: 'jowi',
    name: 'Jowi',
    description: 'Узбекская система автоматизации ресторанов.',
    logo: '/integrations/jowi.png',
    docsUrl: 'https://jowi.club/',
    supportedEvents: ['menu.sync', 'order.created'],
    configSchema: [
      { key: 'apiKey', label: 'API ключ', type: 'password', required: true },
      { key: 'restaurantId', label: 'ID ресторана', type: 'text', required: true },
    ],
  },

  // ===== ПЛАТЕЖНЫЕ СИСТЕМЫ =====
  {
    type: 'payment',
    provider: 'click',
    name: 'Click',
    description: 'Популярная платёжная система в Узбекистане.',
    logo: '/integrations/click.png',
    docsUrl: 'https://docs.click.uz/',
    supportedEvents: ['payment.initiated', 'payment.completed', 'payment.failed'],
    configSchema: [
      { key: 'merchantId', label: 'Merchant ID', type: 'text', required: true },
      { key: 'serviceId', label: 'Service ID', type: 'text', required: true },
      { key: 'secretKey', label: 'Secret Key', type: 'password', required: true },
    ],
  },
  {
    type: 'payment',
    provider: 'payme',
    name: 'Payme',
    description: 'Платёжная система Payme для приёма платежей.',
    logo: '/integrations/payme.png',
    docsUrl: 'https://developer.payme.uz/',
    supportedEvents: ['payment.initiated', 'payment.completed', 'payment.failed', 'payment.refunded'],
    configSchema: [
      { key: 'merchantId', label: 'Merchant ID', type: 'text', required: true },
      { key: 'secretKey', label: 'Secret Key', type: 'password', required: true },
      { key: 'testMode', label: 'Тестовый режим', type: 'boolean' },
    ],
  },
  {
    type: 'payment',
    provider: 'uzcard',
    name: 'UzCard',
    description: 'Приём платежей по картам UzCard.',
    logo: '/integrations/uzcard.png',
    supportedEvents: ['payment.initiated', 'payment.completed', 'payment.failed'],
    configSchema: [
      { key: 'terminalId', label: 'Terminal ID', type: 'text', required: true },
      { key: 'merchantKey', label: 'Merchant Key', type: 'password', required: true },
    ],
  },

  // ===== ДОСТАВКА =====
  {
    type: 'delivery',
    provider: 'yandex_delivery',
    name: 'Яндекс Доставка',
    description: 'Курьерская служба Яндекс для доставки заказов.',
    logo: '/integrations/yandex-delivery.png',
    docsUrl: 'https://yandex.ru/dev/logistics/',
    supportedEvents: ['delivery.assigned', 'delivery.picked_up', 'delivery.in_transit', 'delivery.completed'],
    configSchema: [
      { key: 'oauthToken', label: 'OAuth Token', type: 'password', required: true },
      { key: 'companyId', label: 'ID компании', type: 'text', required: true },
    ],
  },
  {
    type: 'delivery',
    provider: 'express24',
    name: 'Express24',
    description: 'Локальная служба доставки в Узбекистане.',
    logo: '/integrations/express24.png',
    supportedEvents: ['delivery.assigned', 'delivery.completed'],
    configSchema: [
      { key: 'apiKey', label: 'API ключ', type: 'password', required: true },
      { key: 'partnerId', label: 'Partner ID', type: 'text', required: true },
    ],
  },

  // ===== ФИСКАЛИЗАЦИЯ =====
  {
    type: 'fiscal',
    provider: 'ofd_uz',
    name: 'OFD Узбекистан',
    description: 'Фискализация чеков через ОФД (налоговая).',
    logo: '/integrations/ofd.png',
    supportedEvents: ['receipt.created', 'receipt.sent'],
    configSchema: [
      { key: 'inn', label: 'ИНН', type: 'text', required: true },
      { key: 'terminalId', label: 'ID терминала', type: 'text', required: true },
      { key: 'apiKey', label: 'API ключ', type: 'password', required: true },
    ],
  },

  // ===== МАРКЕТИНГ / УВЕДОМЛЕНИЯ =====
  {
    type: 'marketing',
    provider: 'eskiz',
    name: 'Eskiz SMS',
    description: 'SMS уведомления через Eskiz.uz.',
    logo: '/integrations/eskiz.png',
    docsUrl: 'https://eskiz.uz/developers/',
    supportedEvents: ['order.created', 'order.confirmed', 'order.ready', 'order.delivered'],
    configSchema: [
      { key: 'email', label: 'Email', type: 'text', required: true },
      { key: 'password', label: 'Пароль', type: 'password', required: true },
      { key: 'sender', label: 'Имя отправителя', type: 'text', placeholder: '4546' },
    ],
  },
  {
    type: 'marketing',
    provider: 'telegram_bot',
    name: 'Telegram Bot',
    description: 'Уведомления через Telegram бота.',
    logo: '/integrations/telegram.png',
    supportedEvents: ['order.created', 'order.confirmed', 'order.ready'],
    configSchema: [
      { key: 'botToken', label: 'Bot Token', type: 'password', required: true },
      { key: 'chatId', label: 'Chat ID', type: 'text', required: true, description: 'ID чата или канала для уведомлений' },
    ],
  },
  {
    type: 'marketing',
    provider: 'sendgrid',
    name: 'SendGrid',
    description: 'Email уведомления через SendGrid.',
    logo: '/integrations/sendgrid.png',
    docsUrl: 'https://docs.sendgrid.com/',
    supportedEvents: ['order.created', 'order.confirmed', 'order.delivered'],
    configSchema: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      { key: 'fromEmail', label: 'Email отправителя', type: 'text', required: true },
      { key: 'fromName', label: 'Имя отправителя', type: 'text' },
    ],
  },
];

// Группировка по типам
export const INTEGRATION_GROUPS = {
  pos: {
    name: '🖥️ POS системы',
    description: 'Интеграция с кассовыми системами для синхронизации меню и отправки заказов',
  },
  payment: {
    name: '💳 Платежи',
    description: 'Приём онлайн-платежей от клиентов',
  },
  delivery: {
    name: '🚗 Доставка',
    description: 'Интеграция с курьерскими службами',
  },
  fiscal: {
    name: '🧾 Фискализация',
    description: 'Отправка чеков в налоговую (OFD)',
  },
  marketing: {
    name: '📢 Уведомления',
    description: 'SMS, Email и Push уведомления клиентам',
  },
};

// Получить провайдера по типу и имени
export function getProvider(type: string, provider: string): IntegrationProvider | undefined {
  return INTEGRATION_PROVIDERS.find((p) => p.type === type && p.provider === provider);
}

// Получить всех провайдеров по типу
export function getProvidersByType(type: string): IntegrationProvider[] {
  return INTEGRATION_PROVIDERS.filter((p) => p.type === type);
}

