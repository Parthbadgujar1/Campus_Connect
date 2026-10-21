import type { ModuleDefinition } from '../plugins/module-guard.js';
import { adminRoutes } from './admin/admin.routes.js';
import { announcementRoutes } from './announcements/announcements.routes.js';
import { contactRoutes } from './contact/contact.routes.js';
import { privacyRoutes } from './privacy/privacy.routes.js';
import { realtimeRoutes } from './realtime/realtime.routes.js';
import { reportRoutes } from './reports/reports.routes.js';
import { searchRoutes } from './search/search.routes.js';
import { authRoutes } from './auth/auth.routes.js';
import { chatRoutes } from './chats/chats.routes.js';
import { eventRoutes } from './events/events.routes.js';
import { feedRoutes } from './feed/feed.routes.js';
import { contentRoutes, uploadRoutes } from './files/files.routes.js';
import { healthRoutes } from './health/health.routes.js';
import { hushRoutes } from './hush/hush.routes.js';
import { lectureRoutes } from './lectures/lectures.routes.js';
import { lostFoundRoutes } from './lost-found/lost-found.routes.js';
import { marketplaceRoutes } from './marketplace/marketplace.routes.js';
import { metaRoutes } from './meta/meta.routes.js';
import { notificationRoutes } from './notifications/notifications.routes.js';
import { opportunityRoutes } from './opportunities/opportunities.routes.js';
import { resourceRoutes } from './resources/resources.routes.js';
import { spaceRoutes } from './spaces/spaces.routes.js';
import { surveyRoutes } from './surveys/surveys.routes.js';
import { feedbackRoutes } from './feedback/feedback.routes.js';
import { userRoutes } from './users/users.routes.js';

// Every feature module and its URL prefix. Each one runs in its own bulkhead (see
// plugins/module-guard.ts) and can be switched off with its feature flag.
//
// flag: null marks core modules that must always stay on:
//   auth   - switching it off would lock admins out too (sign-ups have module.registration)
//   users  - account and privacy settings must always be reachable
//   files  - viewing existing files keeps working even while uploads are switched off
export const modules: ModuleDefinition[] = [
  { name: 'health', prefix: '', plugin: healthRoutes, flag: null },
  { name: 'meta', prefix: '/v1/meta', plugin: metaRoutes, flag: null },
  { name: 'auth', prefix: '/v1/auth', plugin: authRoutes, flag: null },
  { name: 'users', prefix: '/v1', plugin: userRoutes, flag: null },
  { name: 'files', prefix: '/v1/files', plugin: contentRoutes, flag: null },
  { name: 'uploads', prefix: '/v1/files', plugin: uploadRoutes },
  { name: 'notifications', prefix: '/v1/notifications', plugin: notificationRoutes },
  { name: 'feed', prefix: '/v1', plugin: feedRoutes },
  { name: 'spaces', prefix: '/v1', plugin: spaceRoutes },
  { name: 'events', prefix: '/v1/events', plugin: eventRoutes },
  { name: 'announcements', prefix: '/v1/announcements', plugin: announcementRoutes },
  { name: 'opportunities', prefix: '/v1', plugin: opportunityRoutes },
  { name: 'resources', prefix: '/v1', plugin: resourceRoutes },
  { name: 'lectures', prefix: '/v1/lectures', plugin: lectureRoutes },
  { name: 'hush', prefix: '/v1/hush', plugin: hushRoutes },
  { name: 'lost_found', prefix: '/v1/lost-found', plugin: lostFoundRoutes },
  { name: 'marketplace', prefix: '/v1/listings', plugin: marketplaceRoutes },
  { name: 'chats', prefix: '/v1', plugin: chatRoutes },
  { name: 'realtime', prefix: '/v1/realtime', plugin: realtimeRoutes },
  { name: 'search', prefix: '/v1/search', plugin: searchRoutes },
  { name: 'reports', prefix: '/v1/reports', plugin: reportRoutes },
  { name: 'contact', prefix: '/v1/contact', plugin: contactRoutes },
  { name: 'surveys', prefix: '/v1', plugin: surveyRoutes },
  { name: 'feedback', prefix: '/v1', plugin: feedbackRoutes },
  // Privacy rights and the admin console must always be reachable.
  { name: 'privacy', prefix: '/v1', plugin: privacyRoutes, flag: null },
  { name: 'admin', prefix: '/v1/admin', plugin: adminRoutes, flag: null },
];
