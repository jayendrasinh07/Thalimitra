const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const read = file => readFileSync(file, 'utf8');
const app = read('src/App.tsx');
const context = read('src/context/AppContext.tsx');
const flags = read('src/config/featureFlags.ts');
const howItWorks = read('src/pages/HowItWorksPage.tsx');
const auth = read('src/components/modals/AuthModal.tsx');
const order = read('src/pages/OrderOncePage.tsx');
const navbar = read('src/components/common/Navbar.tsx');
const footer = read('src/components/common/Footer.tsx');
const nativeNavigation = read('src/components/native/NativeNavigation.tsx');
const ops = read('src/OpsApp.tsx');
const mfa = read('src/components/kitchen/KitchenMfaGate.tsx');

assert.match(flags, /SUBSCRIPTIONS_ENABLED\s*=\s*false/);
assert.doesNotMatch(app, /import\('\.\/components\/modals\/SubscribeModal'\)/);
assert.doesNotMatch(app, /<SubscribeModal\s*\/?>/);
assert.match(context, /tab === 'meal_plans'.*tab === 'my_subscription'.*tab === 'subscription_management'/s);
assert.match(context, /if \(!SUBSCRIPTIONS_ENABLED\)\s*{\s*setActiveTab\('order_once'\)/s);
assert.match(howItWorks, /Breakfast closes at 10:00 PM the previous night\. Lunch at 10:30 AM\. Dinner at 5:30 PM\./);
assert.match(howItWorks, /setActiveTab\('order_once'\)/);
assert.doesNotMatch(howItWorks, /setIsSubscribeModalOpen|Subscriptions carry over|9:30 AM \(Lunch\)|5:00 PM \(Dinner\)/);
assert.doesNotMatch(auth, /meal subscriptions/);
assert.match(app, /activeTab === 'order_once'.*thalimitra:native-back/s);
assert.match(order, /addEventListener\('thalimitra:native-back'/);
assert.match(order, /Back to \{ORDER_STEPS\[currentStep - 2\]/);
for (const [id, tab] of [
  ['nav-home', 'home'], ['nav-menu', 'todays_menu'], ['nav-how', 'how_it_works'],
  ['nav-business', 'corporate'], ['nav-order-now-btn', 'todays_menu']
]) {
  assert.match(navbar, new RegExp(`id="${id}"[\\s\\S]*?handleNavClick\\('${tab}'\\)`));
}
for (const tab of ['home', 'todays_menu', 'how_it_works', 'quality_standards', 'why_us', 'students', 'workers', 'corporate', 'coverage', 'contact']) {
  assert.match(footer, new RegExp(`handleNav\\('${tab}'\\)`));
}
for (const tab of ['home', 'todays_menu', 'order_history', 'customer_dashboard']) {
  assert.match(nativeNavigation, new RegExp(`id: '${tab}'`));
}
assert.match(nativeNavigation, /activeTab === 'order_once'.*thalimitra:native-back/s);
assert.match(ops, /role === 'kitchen' \|\| role === 'admin'/);
assert.match(ops, /<KitchenMfaGate/);
assert.match(mfa, /currentLevel === 'aal2'/);

console.log('PASS: customer route hierarchy, disabled subscription paths, exact cutoffs, and Operations role/MFA isolation');
