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
const accountPage = read('src/pages/NativeAccountPage.tsx');
const addressPage = read('src/pages/DeliveryAddressesPage.tsx');
const addressDisplay = read('src/utils/addressDisplay.ts');
const authService = read('src/services/authService.ts');
const orderNavigation = read('src/services/orderNavigation.ts');
const ops = read('src/OpsApp.tsx');
const mfa = read('src/components/kitchen/KitchenMfaGate.tsx');
const stepOne = read('src/components/order/Step1DateMealSlot.tsx');
const customization = read('src/components/order/Step3Customization.tsx');
const publicMenu = read('src/components/public/TodaysMenuSection.tsx');
const homeMenu = read('src/components/public/HomeMealSelector.tsx');
const availabilityEngine = read('src/services/availabilityEngine.ts');
const config = read('src/data/config.ts');

assert.match(flags, /SUBSCRIPTIONS_ENABLED\s*=\s*true/);
assert.match(app, /import\('\.\/components\/modals\/SubscribeModal'\)/);
assert.match(app, /<SubscribeModal\s*\/?>/);
assert.match(app, /case 'meal_plans':[\s\S]*case 'my_subscription':[\s\S]*<MealPlansPage/);
assert.match(context, /tab === 'meal_plans'.*tab === 'my_subscription'.*tab === 'subscription_management'/s);
assert.match(context, /if \(!SUBSCRIPTIONS_ENABLED\)\s*{\s*setActiveTab\('order_once'\)/s);
assert.match(howItWorks, /Breakfast closes at 10:00 PM the previous night\. Lunch at 10:30 AM\. Dinner at 5:30 PM\./);
assert.match(howItWorks, /setActiveTab\('order_once'\)/);
assert.doesNotMatch(howItWorks, /setIsSubscribeModalOpen|Subscriptions carry over|9:30 AM \(Lunch\)|5:00 PM \(Dinner\)/);
assert.doesNotMatch(auth, /meal subscriptions/);
assert.match(app, /activeTab === 'order_once'.*thalimitra:native-back/s);
assert.match(order, /addEventListener\('thalimitra:native-back'/);
assert.match(order, /Back to \{ORDER_STEPS\[currentStep - 2\]/);
assert.match(context, /rememberOrderOrigin\(activeTab\)/);
assert.match(order, /const destination = getOrderOrigin\(\)/);
assert.match(order, /else exitOrderFlow\(\)/);
assert.match(order, /onClick=\{exitOrderFlow\}/);
assert.doesNotMatch(order, /else setActiveTab\('todays_menu'\)/);
for (const origin of ['home', 'todays_menu', 'order_history', 'customer_dashboard']) {
  assert.match(orderNavigation, new RegExp(`'${origin}'`));
}
assert.match(orderNavigation, /return isOrderOrigin\(saved\) \? saved : 'home'/);
for (const [id, tab] of [
  ['nav-home', 'home'], ['nav-menu', 'todays_menu'], ['nav-how', 'how_it_works'],
  ['nav-plans', 'meal_plans'], ['nav-business', 'corporate'], ['nav-order-now-btn', 'todays_menu']
]) {
  assert.match(navbar, new RegExp(`id="${id}"[\\s\\S]*?handleNavClick\\('${tab}'\\)`));
}
for (const tab of ['home', 'todays_menu', 'how_it_works', 'quality_standards', 'why_us', 'students', 'workers', 'corporate', 'coverage', 'contact']) {
  assert.match(footer, new RegExp(`handleNav\\('${tab}'\\)`));
}
for (const tab of ['home', 'todays_menu', 'meal_plans', 'order_history', 'customer_dashboard']) {
  assert.match(nativeNavigation, new RegExp(`id: '${tab}'`));
}
assert.match(context, /This Operations account can sign in only at ops\.thalimitra\.com/);
assert.match(context, /roles\.includes\('customer'\)\s*&&\s*!hasOperationsRole/);
assert.match(config, /connect\.vriddhibusiness@gmail\.com/);
assert.match(nativeNavigation, /activeTab === 'order_once'.*thalimitra:native-back/s);
assert.match(accountPage, /setActiveTab\('delivery_addresses'\)/);
assert.doesNotMatch(accountPage, /Delivery addresses[\s\S]{0,250}setIsLocationModalOpen\(true\)/);
assert.match(addressPage, /Your saved addresses/);
assert.match(addressPage, /getAddressFullLine\(address\)/);
assert.match(addressPage, /Add a new address/);
assert.match(addressDisplay, /address\.houseNumber/);
assert.match(addressDisplay, /address\.building/);
assert.match(addressDisplay, /address\.landmark/);
assert.match(context, /isCustomerDataLoading/);
assert.match(context, /Promise\.allSettled/);
assert.match(context, /confirmedAddress:address/);
assert.match(authService, /getSession\(\)[\s\S]*getUser\(\)/);
assert.match(authService, /Failed to fetch roles:[\s\S]*throw err/);
assert.match(ops, /role === 'kitchen' \|\| role === 'admin'/);
assert.match(ops, /<KitchenMfaGate/);
assert.match(mfa, /currentLevel === 'aal2'/);
assert.doesNotMatch(stepOne, /07:30 AM|09:00 AM|01:30 PM|07:30 PM|09:00 PM/);
assert.doesNotMatch(availabilityEngine, /07:30 AM|09:00 AM|01:30 PM|07:30 PM|09:00 PM|05:30 PM/);
assert.doesNotMatch(publicMenu, /Published' : 'Awaiting menu|Awaiting menu/);
assert.doesNotMatch(homeMenu, /Menu ready/);
assert.match(customization, /id="toggle-preparation-preferences"/);
assert.match(customization, /aria-expanded=\{showPreparationPreferences\}/);
assert.match(customization, /showPreparationPreferences && <div id="preparation-preference-options"/);
assert.match(customization, /const preparationSummary =/);
assert.match(customization, /spiceLevel === 'Less Spicy' \? 'Very mild \(less spicy\)' : 'Regular mild'/);
assert.match(customization, /oilLevel === 'Less Oil \(Fit\)' \? 'Low-oil \(no ghee\)' : 'Homestyle ghee brush'/);
assert.match(customization, /aria-live="polite">\{preparationSummary\}/);

console.log('PASS: customer route hierarchy, subscription routes, exact cutoffs, and Operations role/MFA isolation');
