/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/common/Navbar';
import { Footer } from './components/common/Footer';
import { RoleSwitcher } from './components/common/RoleSwitcher';
import { ToastContainer } from './components/common/ToastContainer';
import { authService } from './services/authService';
import { DELIVERY_DAY_PLANS_ENABLED } from './config/featureFlags';

import { DeveloperLocationDiagnostics } from './components/common/DeveloperLocationDiagnostics';

// Pages
import { Home } from './pages/Home';
import { MobileBottomBar } from './components/common/MobileBottomBar';
import { NativeNavigation } from './components/native/NativeNavigation';
import { NativeAccountPage } from './pages/NativeAccountPage';
import { CustomerPageSkeleton } from './components/common/CustomerLoadingSkeleton';
import { PushNotificationBridge } from './components/notifications/PushNotificationBridge';

if (Capacitor.isNativePlatform()) document.documentElement.classList.add('native-app');

const HowItWorksPage = React.lazy(() => import('./pages/HowItWorksPage').then((module) => ({ default: module.HowItWorksPage })));
const TodaysMenuPage = React.lazy(() => import('./pages/TodaysMenuPage').then((module) => ({ default: module.TodaysMenuPage })));
const OrderOncePage = React.lazy(() => import('./pages/OrderOncePage').then((module) => ({ default: module.OrderOncePage })));
const MealPlansPage = React.lazy(() => import('./pages/MealPlansPage').then((module) => ({ default: module.MealPlansPage })));
const DeliveryDayPlansPage = React.lazy(() => import('./pages/DeliveryDayPlansPage').then((module) => ({ default: module.DeliveryDayPlansPage })));
const WhyUsPage = React.lazy(() => import('./pages/WhyUsPage').then((module) => ({ default: module.WhyUsPage })));
const GandhinagarCoveragePage = React.lazy(() => import('./pages/GandhinagarCoveragePage').then((module) => ({ default: module.GandhinagarCoveragePage })));
const StudentsPage = React.lazy(() => import('./pages/StudentsPage').then((module) => ({ default: module.StudentsPage })));
const WorkersPage = React.lazy(() => import('./pages/WorkersPage').then((module) => ({ default: module.WorkersPage })));
const CorporatePage = React.lazy(() => import('./pages/CorporatePage').then((module) => ({ default: module.CorporatePage })));
const TraceabilityPage = React.lazy(() => import('./pages/TraceabilityPage').then((module) => ({ default: module.TraceabilityPage })));
const QualityStandardsPage = React.lazy(() => import('./pages/QualityStandardsPage').then((module) => ({ default: module.QualityStandardsPage })));
const ContactPage = React.lazy(() => import('./pages/ContactPage').then((module) => ({ default: module.ContactPage })));
const OrderHistoryPage = React.lazy(() => import('./pages/OrderHistoryPage').then((module) => ({ default: module.OrderHistoryPage })));
const DeliveryAddressesPage = React.lazy(() => import('./pages/DeliveryAddressesPage').then((module) => ({ default: module.DeliveryAddressesPage })));
const NotificationsPage = React.lazy(() => import('./pages/NotificationsPage').then((module) => ({ default: module.NotificationsPage })));
const PasswordRecoveryPage = React.lazy(() => import('./pages/PasswordRecoveryPage').then((module) => ({ default: module.PasswordRecoveryPage })));
const OrderOnceModal = React.lazy(() => import('./components/modals/OrderOnceModal').then((module) => ({ default: module.OrderOnceModal })));
const TraceabilityModal = React.lazy(() => import('./components/modals/TraceabilityModal').then((module) => ({ default: module.TraceabilityModal })));
const CorporateEnquiryModal = React.lazy(() => import('./components/modals/CorporateEnquiryModal').then((module) => ({ default: module.CorporateEnquiryModal })));
const FeedbackModal = React.lazy(() => import('./components/modals/FeedbackModal').then((module) => ({ default: module.FeedbackModal })));
const AreaCheckerModal = React.lazy(() => import('./components/modals/AreaCheckerModal').then((module) => ({ default: module.AreaCheckerModal })));
const LocationSelectorModal = React.lazy(() => import('./components/modals/LocationSelectorModal').then((module) => ({ default: module.LocationSelectorModal })));
const LegalModal = React.lazy(() => import('./components/modals/LegalModal').then((module) => ({ default: module.LegalModal })));
const AuthModal = React.lazy(() => import('./components/modals/AuthModal').then((module) => ({ default: module.AuthModal })));
const SubscribeModal = React.lazy(() => import('./components/modals/SubscribeModal').then((module) => ({ default: module.SubscribeModal })));
const DeliveryDayPlanModal = React.lazy(() => import('./components/modals/DeliveryDayPlanModal').then((module) => ({ default: module.DeliveryDayPlanModal })));

const PageLoader = () => <CustomerPageSkeleton />;

const AndroidBackHandler: React.FC = () => {
  const {
    activeTab, setActiveTab,
    isLocationModalOpen, setIsLocationModalOpen,
    isAuthModalOpen, setIsAuthModalOpen,
    isOrderOnceModalOpen, setIsOrderOnceModalOpen,
    isSubscribeModalOpen, setIsSubscribeModalOpen,
    isLegalModalOpen, setIsLegalModalOpen,
  } = useApp();

  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false;
    let remove: (() => Promise<void>) | undefined;
    void CapacitorApp.addListener('backButton', () => {
      if (isLocationModalOpen) return setIsLocationModalOpen(false);
      if (isAuthModalOpen) return setIsAuthModalOpen(false);
      if (isOrderOnceModalOpen) return setIsOrderOnceModalOpen(false);
      if (isSubscribeModalOpen) return setIsSubscribeModalOpen(false);
      if (isLegalModalOpen) return setIsLegalModalOpen(false);
      if (activeTab === 'order_once') return window.dispatchEvent(new Event('thalimitra:native-back'));
      if (activeTab === 'contact' || activeTab === 'coverage' || activeTab === 'delivery_addresses' || activeTab === 'notifications') return setActiveTab('customer_dashboard');
      if (activeTab !== 'home') return setActiveTab('home');
      void CapacitorApp.exitApp();
    }).then(listener => {
      if (disposed) void listener.remove();
      else remove = () => listener.remove();
    });
    return () => { disposed = true; void remove?.(); };
  }, [activeTab, isLocationModalOpen, isAuthModalOpen, isOrderOnceModalOpen, isSubscribeModalOpen, isLegalModalOpen]);
  return null;
};

const AndroidRecoveryLinkHandler: React.FC = () => {
  const { setActiveTab } = useApp();
  const setActiveTabRef = React.useRef(setActiveTab);
  setActiveTabRef.current = setActiveTab;
  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false;
    let handledUrl = '';
    let remove: (() => Promise<void>) | undefined;
    const open = async (url: string) => {
      if (url === handledUrl) return;
      handledUrl = url;
      if (await authService.consumeMobileRecoveryLink(url) && !disposed) setActiveTabRef.current('password_recovery');
    };
    void CapacitorApp.addListener('appUrlOpen', ({ url }) => { void open(url); }).then(listener => {
      if (disposed) void listener.remove();
      else remove = () => listener.remove();
    });
    void CapacitorApp.getLaunchUrl().then(result => { if (result?.url) void open(result.url); });
    return () => { disposed = true; void remove?.(); };
  }, []);
  return null;
};

const MainContent: React.FC = () => {
  const isNative = Capacitor.isNativePlatform();
  const {
    activeTab,
    isOrderOnceModalOpen,
    isSubscribeModalOpen,
    isTraceabilityModalOpen,
    isCorporateModalOpen,
    isFeedbackModalOpen,
    isAreaCheckerOpen,
    isLegalModalOpen,
    isAuthModalOpen,
    isLocationModalOpen,
    setIsLocationModalOpen,
  } = useApp();

  const [hasOpenedSubscribe, setHasOpenedSubscribe] = React.useState(isSubscribeModalOpen);
  React.useEffect(() => {
    if (isSubscribeModalOpen) setHasOpenedSubscribe(true);
  }, [isSubscribeModalOpen]);

  if (activeTab === 'password_recovery') {
    return (
      <div className="min-h-screen bg-[#f5f6f2] text-stone-900 font-sans selection:bg-emerald-200 selection:text-emerald-950">
        <React.Suspense fallback={<PageLoader />}>
          <PasswordRecoveryPage />
        </React.Suspense>
        <ToastContainer />
      </div>
    );
  }

  const renderActivePage = () => {
    switch (activeTab) {
      case 'home':
        return <Home />;
      case 'how_it_works':
        return <HowItWorksPage />;
      case 'meal_plans':
      case 'my_subscription':
        return DELIVERY_DAY_PLANS_ENABLED ? <DeliveryDayPlansPage /> : <MealPlansPage />;
      case 'todays_menu':
        return <TodaysMenuPage />;
      case 'order_once':
        return <OrderOncePage />;
      case 'why_us':
        return <WhyUsPage />;
      case 'coverage':
        return <GandhinagarCoveragePage />;
      case 'students':
        return <StudentsPage />;
      case 'workers':
        return <WorkersPage />;
      case 'corporate':
        return <CorporatePage />;
      case 'traceability':
        return <TraceabilityPage />;
      case 'quality_standards':
        return <QualityStandardsPage />;
      case 'contact':
        return <ContactPage />;
      case 'customer_dashboard':
        return <NativeAccountPage />;
      case 'order_history':
        return <OrderHistoryPage />;
      case 'delivery_addresses':
        return <DeliveryAddressesPage />;
      case 'notifications':
        return <NotificationsPage />;
      default:
        return <Home />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-stone-900 font-sans selection:bg-emerald-200 selection:text-emerald-950">
      {isNative ? <NativeNavigation /> : <Navbar />}
      <main className={isNative ? 'flex-1 w-full pb-24' : 'flex-1 w-full pb-16 sm:pb-0'}>
        <React.Suspense fallback={<PageLoader />}>{renderActivePage()}</React.Suspense>
      </main>
      {!isNative && <><Footer /><MobileBottomBar /><RoleSwitcher /></>}
      <ToastContainer />

      <React.Suspense fallback={null}>
        {isOrderOnceModalOpen && <OrderOnceModal />}
        {hasOpenedSubscribe && (DELIVERY_DAY_PLANS_ENABLED ? <DeliveryDayPlanModal /> : <SubscribeModal />)}
        {isTraceabilityModalOpen && <TraceabilityModal />}
        {isCorporateModalOpen && <CorporateEnquiryModal />}
        {isFeedbackModalOpen && <FeedbackModal />}
        {isAreaCheckerOpen && <AreaCheckerModal />}
        {isLegalModalOpen && <LegalModal />}
        {isAuthModalOpen && <AuthModal />}
        {isLocationModalOpen && (
          <LocationSelectorModal
            isOpen
            onClose={() => setIsLocationModalOpen(false)}
          />
        )}
      </React.Suspense>
      {(import.meta as any).env?.DEV && <DeveloperLocationDiagnostics />}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AndroidBackHandler />
      <AndroidRecoveryLinkHandler />
      <PushNotificationBridge />
      <MainContent />
    </AppProvider>
  );
}
