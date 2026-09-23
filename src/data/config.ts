import { 
  MealPlan, 
  DayMenu, 
  DeliveryCluster, 
  CorporateAccount, 
  CustomerFeedback, 
  UserSubscription,
  KitchenBatch,
  MealTraceabilityInfo
} from '../types';

export const BRAND_CONFIG = {
  name: "Thalimitra",
  tagline: "Roz ka khana. Sahi khana.",
  subTagline: "Fresh home-style meals in Gandhinagar",
  location: "Gandhinagar, Gujarat, India",
  email: "parmarjayendrasinh41@gmail.com",
  fssaiNumber: "Licence details will be published after verification",
  heroHeadline: "Roz ka khana. Sahi khana.",
  heroSubtitle: "Fresh, home-style meals for students, workers and professionals in Gandhinagar — without the daily hassle of outside food.",
  vision: "Gandhinagar → Ahmedabad → Gujarat"
};

export const MEAL_PLANS: MealPlan[] = [
  {
    id: 'daily',
    name: 'Daily Trial',
    tagline: 'Experience our authentic home taste before committing',
    idealFor: 'First-time users & temporary visitors in Gandhinagar',
    pricePerMeal: 99,
    totalMeals: 1,
    totalPrice: 99,
    savingsPercentage: 0,
    features: [
      'Freshly cooked hot home meal',
      '4 Phulka Rotis + Seasonal Sabji + Dal Tadka + Rice + Salad + Chaas',
      'Choose Lunch (12:00-1:00 PM) or Dinner (7:30-8:30 PM)',
      '100% Spill-proof hygienic hot packaging',
      'Zero delivery fee in Gandhinagar clusters'
    ],
    flexibility: {
      pauseAllowedDays: 0,
      skipNoticeHours: 3,
      freeWeekendCancellation: true
    }
  },
  {
    id: 'weekly_7',
    name: '7-Day Routine',
    tagline: 'Short-term convenience for exam weeks & busy work sprints',
    idealFor: 'Interns, project employees, and visiting professionals',
    pricePerMeal: 89,
    totalMeals: 7,
    totalPrice: 623,
    savingsPercentage: 10,
    features: [
      '7 Fresh home-cooked meals (Lunch or Dinner)',
      'Daily rotating menu - never eat the same meal twice',
      'Option to skip 1 meal with 2 hours advance notice',
      'Switch between Gujarati, Jain, or Kathiyawadi choice',
      'Free cluster doorstep delivery'
    ],
    flexibility: {
      pauseAllowedDays: 2,
      skipNoticeHours: 2,
      freeWeekendCancellation: true
    }
  },
  {
    id: 'half_month_15',
    name: '15-Day Semester / Work Plan',
    tagline: 'Most popular among students and office executives',
    idealFor: 'Students near PDPU/DA-IICT & IT employees in Infocity',
    pricePerMeal: 82,
    totalMeals: 15,
    totalPrice: 1230,
    savingsPercentage: 17,
    isPopular: true,
    features: [
      '15 Fresh daily hot meals delivered on schedule',
      'Flexible Pause & Resume: Pause anytime during holidays or travel',
      'Custom spice & oil control: Low-oil fitness options available',
      'Sunday Special Traditional Gujarati/Kathiyawadi Thali included',
      'Real-time WhatsApp meal updates & traceability'
    ],
    flexibility: {
      pauseAllowedDays: 5,
      skipNoticeHours: 2,
      freeWeekendCancellation: true
    }
  },
  {
    id: 'monthly_30',
    name: 'Monthly Everyday Plan',
    tagline: 'Best value. Zero cooking headaches. Fixed routine.',
    idealFor: 'PG residents, corporate staff, and regular Gandhinagar residents',
    pricePerMeal: 76,
    totalMeals: 30,
    totalPrice: 2280,
    savingsPercentage: 23,
    features: [
      '30 Hot, wholesome meals delivered with military punctuality',
      'Unlimited pause up to 10 days rollover validity',
      'Complimentary chilled Masala Chaas every single weekday',
      'Free upgrade to Jain Satvik or High-Fiber Multigrain Roti',
      'Dedicated Cluster Delivery Partner assigned for your doorstep'
    ],
    flexibility: {
      pauseAllowedDays: 10,
      skipNoticeHours: 2,
      freeWeekendCancellation: true
    }
  },
  {
    id: 'corporate_custom',
    name: 'Corporate & Factory Tier',
    tagline: 'Bulk nutritious catering for companies, tech parks & manufacturing plants',
    idealFor: 'GIFT City offices, Sector 24-28 GIDC factories & IT campuses',
    pricePerMeal: 68,
    totalMeals: 100,
    totalPrice: 6800,
    savingsPercentage: 31,
    features: [
      'Subsidized employee meal programs with automated billing',
      'Bulk thermo-insulated food-grade delivery crates at exact shift times',
      'Live HR Dashboard to monitor daily meal counts, skips & staff ratings',
      'Customizable menu (Gujarati / North Indian / Jain split)',
      'Monthly consolidated GST invoice & dedicated account manager'
    ],
    flexibility: {
      pauseAllowedDays: 30,
      skipNoticeHours: 4,
      freeWeekendCancellation: true
    }
  }
];

export const WEEKLY_MENU: DayMenu[] = [
  {
    dayOfWeek: 'Monday',
    lunch: {
      title: 'Energizing Monday Thali',
      chefNote: 'Steamed with minimal groundnut oil and fresh morning market produce.',
      items: [
        { id: 'm1', name: 'Ringan No Olo (Smoky Eggplant Mash)', category: 'sabji', description: 'Traditional Saurashtra style with green garlic & roasted cumin', isJainAvailable: false, highlight: 'Signature Dish' },
        { id: 'm2', name: 'Sev Tameta Nu Shaak (Sweet & Tangy Tomato Curry)', category: 'sabji', description: 'Fresh tomatoes tempered with mustard & topped with crispy sev', isJainAvailable: true },
        { id: 'm3', name: 'Panchmel Dal Tadka', category: 'dal_kadhi', description: 'Slow cooked mix of 5 lentils with ghee tadka', isJainAvailable: true },
        { id: 'm4', name: '4 Soft Phulka Rotis (Fresh Wheat / Option for Ghee)', category: 'roti_bread', description: '100% whole MP Sharbati wheat, no maida', isJainAvailable: true },
        { id: 'm5', name: 'Steamed Jeera Rice', category: 'rice_khichdi', description: 'Aromatic long grain rice tempered with roasted cumin', isJainAvailable: true },
        { id: 'm6', name: 'Fresh Cucumber-Carrot Kachumber & Masala Chaas', category: 'salad_kachumber', description: 'Probiotic spiced buttermilk with mint and roasted jeera', isJainAvailable: true }
      ],
      nutrition: {
        calories: 580,
        proteinGrams: 19,
        carbsGrams: 84,
        fatGrams: 14,
        fiberGrams: 11,
        oilLevel: 'Controlled'
      }
    },
    dinner: {
      title: 'Light Comfort Dinner',
      chefNote: 'Easy to digest comfort meal perfect for post-work or post-study evenings.',
      items: [
        { id: 'md1', name: 'Bhindi Sambhariya (Stuffed Okra)', category: 'sabji', description: 'Fresh tender okra filled with roasted gram flour & gentle spices', isJainAvailable: true },
        { id: 'md2', name: 'Gujarati Khatta Meetha Kadhi', category: 'dal_kadhi', description: 'Yogurt based curry with ginger, curry leaves and fenugreek', isJainAvailable: true },
        { id: 'md3', name: 'Vagharli Khichdi (Tempered Lentil Rice)', category: 'rice_khichdi', description: 'Moong dal and rice slow cooked with mild whole spices', isJainAvailable: true, highlight: 'Comfort Classic' },
        { id: 'md4', name: '3 Phulka Rotis or 2 Bajra Rotla (Optional)', category: 'roti_bread', description: 'Freshly puffed rotis', isJainAvailable: true },
        { id: 'md5', name: 'Roasted Papad & Lemon Chili Pickle', category: 'salad_kachumber', description: 'Crunchy roasted papad', isJainAvailable: true }
      ],
      nutrition: {
        calories: 520,
        proteinGrams: 16,
        carbsGrams: 78,
        fatGrams: 12,
        fiberGrams: 9,
        oilLevel: 'Very Low (Cold-Pressed)'
      }
    }
  },
  {
    dayOfWeek: 'Tuesday',
    lunch: {
      title: 'Wholesome Greens & Pulses',
      chefNote: 'High in vegetable fiber and essential plant micronutrients.',
      items: [
        { id: 't1', name: 'Methi Ringan Nu Shaak (Fenugreek & Eggplant)', category: 'sabji', description: 'Fresh winter fenugreek leaves with soft brinjals', isJainAvailable: false },
        { id: 't2', name: 'Desi Chana Masala (Brown Chickpeas in Mild Gravy)', category: 'sabji', description: 'High-protein whole black chickpeas cooked home style', isJainAvailable: true, highlight: 'High Protein' },
        { id: 't3', name: 'Surati Dal with Peanuts & Curry Leaves', category: 'dal_kadhi', description: 'Classic sweet & sour yellow toor dal with raw peanuts', isJainAvailable: true },
        { id: 't4', name: '4 Hot Phulkas (Tawa Fresh)', category: 'roti_bread', description: 'Soft thin rotis packed warm', isJainAvailable: true },
        { id: 't5', name: 'Steamed Kolam Rice', category: 'rice_khichdi', description: 'Clean steamed rice', isJainAvailable: true },
        { id: 't6', name: 'Beetroot Onion Salad & Roasted Cumin Buttermilk', category: 'salad_kachumber', description: 'Chilled freshly churned chaas', isJainAvailable: true }
      ],
      nutrition: {
        calories: 610,
        proteinGrams: 22,
        carbsGrams: 88,
        fatGrams: 13,
        fiberGrams: 13,
        oilLevel: 'Controlled'
      }
    },
    dinner: {
      title: 'Sober Night Routine',
      chefNote: 'Balanced carbs with wholesome pulses.',
      items: [
        { id: 'td1', name: 'Lauki (Doodhi) Chana Dal Curry', category: 'sabji', description: 'Hydrating bottle gourd simmered with bengal gram', isJainAvailable: true },
        { id: 'td2', name: 'Dal Fry with Mild Jeera Garlic Tempered', category: 'dal_kadhi', description: 'Yellow toor dal with fresh coriander', isJainAvailable: true },
        { id: 'td3', name: '4 Whole Wheat Phulkas', category: 'roti_bread', description: 'Freshly baked on iron tawa', isJainAvailable: true },
        { id: 'td4', name: 'Steamed Veggie Pulao', category: 'rice_khichdi', description: 'Basmati rice with carrot and green peas', isJainAvailable: true },
        { id: 'td5', name: 'Green Salad with Lemon Wedge', category: 'salad_kachumber', description: 'Sliced radish and cucumber', isJainAvailable: true }
      ],
      nutrition: {
        calories: 540,
        proteinGrams: 18,
        carbsGrams: 80,
        fatGrams: 11,
        fiberGrams: 10,
        oilLevel: 'Very Low (Cold-Pressed)'
      }
    }
  },
  {
    dayOfWeek: 'Wednesday',
    lunch: {
      title: 'Kathiyawadi Delight Feast',
      chefNote: 'Authentic Saurashtra flavors with garlic chutney and roasted spices.',
      items: [
        { id: 'w1', name: 'Dungri Bataka Nu Rasa Vala Shaak (Onion Potato)', category: 'sabji', description: 'Juicy spiced curry made in traditional Gandhinagar style', isJainAvailable: false },
        { id: 'w2', name: 'Karela Sambhariya (Crispy Bitter Gourd without bitterness)', category: 'sabji', description: 'Pan roasted karela coated in besan and jaggery', isJainAvailable: true, highlight: 'Gut Friendly' },
        { id: 'w3', name: 'Lachko Dal with Ghee Drizzle', category: 'dal_kadhi', description: 'Thick creamy toor dal tempered with mustard & asafoetida', isJainAvailable: true },
        { id: 'w4', name: '4 Fresh Phulkas / 2 Bajra Rotla option', category: 'roti_bread', description: 'Made fresh 20 minutes before delivery', isJainAvailable: true },
        { id: 'w5', name: 'Jeera Rice', category: 'rice_khichdi', description: 'Long grain rice', isJainAvailable: true },
        { id: 'w6', name: 'Sirka Onion Salad & Fresh Mint Chaas', category: 'salad_kachumber', description: 'Probiotic digestive drink', isJainAvailable: true }
      ],
      nutrition: {
        calories: 620,
        proteinGrams: 20,
        carbsGrams: 86,
        fatGrams: 15,
        fiberGrams: 12,
        oilLevel: 'Controlled'
      }
    },
    dinner: {
      title: 'Light Moong & Phulka Routine',
      chefNote: 'Rich in easily absorbable protein and minerals.',
      items: [
        { id: 'wd1', name: 'Mag Nu Shaak (Whole Green Moong Curry)', category: 'sabji', description: 'Sprouted and simmered in aromatic mild spices', isJainAvailable: true, highlight: 'Superfood' },
        { id: 'wd2', name: 'Moraiyo / Traditional Kadhi', category: 'dal_kadhi', description: 'Smooth yogurt curry with curry leaves', isJainAvailable: true },
        { id: 'wd3', name: '4 Whole Wheat Phulkas', category: 'roti_bread', description: 'Soft thin phulkas', isJainAvailable: true },
        { id: 'wd4', name: 'Steamed Rice', category: 'rice_khichdi', description: 'Light steamed grains', isJainAvailable: true },
        { id: 'wd5', name: 'Cucumber Kachumber & Ghee Jaggery Bite', category: 'salad_kachumber', description: 'Traditional digestive finish', isJainAvailable: true }
      ],
      nutrition: {
        calories: 510,
        proteinGrams: 21,
        carbsGrams: 76,
        fatGrams: 10,
        fiberGrams: 11,
        oilLevel: 'Very Low (Cold-Pressed)'
      }
    }
  },
  {
    dayOfWeek: 'Thursday',
    lunch: {
      title: 'Paneer & Vibrant Veggies',
      chefNote: 'Fresh malai paneer sourced from local Gandhinagar dairies.',
      items: [
        { id: 'th1', name: 'Matar Paneer Home Style (No Heavy Cream)', category: 'sabji', description: 'Light tomato base with fresh paneer cubes and sweet green peas', isJainAvailable: true, highlight: 'Paneer Special' },
        { id: 'th2', name: 'Sukhi Bhaji (Spiced Dry Potatoes with Sesame)', category: 'sabji', description: 'Tossed with green chilies, coriander & roasted white til', isJainAvailable: false },
        { id: 'th3', name: 'Dal Makhani Home-Fit Edition', category: 'dal_kadhi', description: 'Slow simmered black urad dal cooked with zero heavy cream or synthetic butter', isJainAvailable: true },
        { id: 'th4', name: '4 Soft Ghee Phulkas', category: 'roti_bread', description: '100% Sharbati whole wheat', isJainAvailable: true },
        { id: 'th5', name: 'Brown / White Rice Choice', category: 'rice_khichdi', description: 'Steamed fluffy rice', isJainAvailable: true },
        { id: 'th6', name: 'Radish Carrot Slaw & Masala Buttermilk', category: 'salad_kachumber', description: 'Crisp root salad with lemon', isJainAvailable: true }
      ],
      nutrition: {
        calories: 640,
        proteinGrams: 24,
        carbsGrams: 82,
        fatGrams: 16,
        fiberGrams: 10,
        oilLevel: 'Controlled'
      }
    },
    dinner: {
      title: 'Simple Comfort Khichdi Feast',
      chefNote: 'The quintessential Gujarat night meal - soothing for mind & body.',
      items: [
        { id: 'thd1', name: 'Mix Veg Sukhi Sabji', category: 'sabji', description: 'Carrot, beans, cauliflower & peas lightly sautéed', isJainAvailable: true },
        { id: 'thd2', name: 'Panchkuti Khichdi (5 Lentil Khichdi)', category: 'rice_khichdi', description: 'Wholesome grains cooked with pinch of pure turmeric & desi cow ghee', isJainAvailable: true, highlight: 'Gut Healer' },
        { id: 'thd3', name: 'Gujarati Kadhi with Mustard Tadka', category: 'dal_kadhi', description: 'Smooth spiced yogurt broth', isJainAvailable: true },
        { id: 'thd4', name: '3 Phulka Rotis', category: 'roti_bread', description: 'Light whole wheat rotis', isJainAvailable: true },
        { id: 'thd5', name: 'Roasted Lijjat Papad & Garlic Chutney', category: 'salad_kachumber', description: 'Tangy accompaniment', isJainAvailable: false }
      ],
      nutrition: {
        calories: 500,
        proteinGrams: 17,
        carbsGrams: 75,
        fatGrams: 11,
        fiberGrams: 9,
        oilLevel: 'Very Low (Cold-Pressed)'
      }
    }
  },
  {
    dayOfWeek: 'Friday',
    lunch: {
      title: 'Tinda & Rajma Power Meal',
      chefNote: 'High mineral legumes with comforting gourd sabji.',
      items: [
        { id: 'f1', name: 'Amritsari Style Rajma (Home Gravy)', category: 'sabji', description: 'Jammu red kidney beans slow cooked with ginger and fresh tomatoes', isJainAvailable: true, highlight: 'High Protein' },
        { id: 'f2', name: 'Gourd / Kundru Stir Fry with Mustard', category: 'sabji', description: 'Crisp green seasonal gourd tossed with mild dry spices', isJainAvailable: true },
        { id: 'f3', name: 'Moong Dal Tadka with Hing', category: 'dal_kadhi', description: 'Digestive yellow split moong dal', isJainAvailable: true },
        { id: 'f4', name: '4 Phulka Rotis', category: 'roti_bread', description: 'Soft puffed wheat flatbreads', isJainAvailable: true },
        { id: 'f5', name: 'Steamed Rice', category: 'rice_khichdi', description: 'Steamed rice', isJainAvailable: true },
        { id: 'f6', name: 'Cabbage Sambharo & Chilled Mint Chaas', category: 'salad_kachumber', description: 'Warm stir-fried cabbage salad with mustard seeds', isJainAvailable: true }
      ],
      nutrition: {
        calories: 605,
        proteinGrams: 23,
        carbsGrams: 85,
        fatGrams: 12,
        fiberGrams: 14,
        oilLevel: 'Controlled'
      }
    },
    dinner: {
      title: 'Light Weekend Eve Meal',
      chefNote: 'Easy on the digestive system before the weekend.',
      items: [
        { id: 'fd1', name: 'Batata Ringan Nu Shaak', category: 'sabji', description: 'Classic potato and eggplant pairing with mild spices', isJainAvailable: false },
        { id: 'fd2', name: 'Gujarati Tuver Dal', category: 'dal_kadhi', description: 'Sweet-sour toor dal with fresh ginger and coriander', isJainAvailable: true },
        { id: 'fd3', name: '4 Whole Wheat Phulkas', category: 'roti_bread', description: 'Fresh from tawa', isJainAvailable: true },
        { id: 'fd4', name: 'Steamed Rice with Cumin', category: 'rice_khichdi', description: 'Aromatic jeera rice', isJainAvailable: true },
        { id: 'fd5', name: 'Tomato Cucumber Salad', category: 'salad_kachumber', description: 'Fresh cut with chaat masala', isJainAvailable: true }
      ],
      nutrition: {
        calories: 530,
        proteinGrams: 17,
        carbsGrams: 80,
        fatGrams: 12,
        fiberGrams: 10,
        oilLevel: 'Very Low (Cold-Pressed)'
      }
    }
  },
  {
    dayOfWeek: 'Saturday',
    lunch: {
      title: 'Weekend Special Undhiyu & Puri/Roti',
      chefNote: 'Special slow-braised mixed vegetable delicacy made with fresh surti papdi.',
      items: [
        { id: 's1', name: 'Traditional Surti Undhiyu (Low Oil Version)', category: 'sabji', description: 'Papdi, kand, sweet potato, brinjal with fenugreek muthia in cold-pressed oil', isJainAvailable: false, highlight: 'Gujarat Heritage' },
        { id: 's2', name: 'Aloo Methi Sukhi Sabji', category: 'sabji', description: 'Fresh methi leaves sautéed with baby potatoes', isJainAvailable: false },
        { id: 's3', name: 'Surati Khatti Meethi Dal', category: 'dal_kadhi', description: 'Yellow dal with jaggery & kokum balance', isJainAvailable: true },
        { id: 's4', name: '4 Soft Phulkas or 3 Ajwain Whole Wheat Puris', category: 'roti_bread', description: 'Choice of light rotis or weekend puffed puris', isJainAvailable: true },
        { id: 's5', name: 'Green Peas Rice', category: 'rice_khichdi', description: 'Fragrant rice with fresh tender peas', isJainAvailable: true },
        { id: 's6', name: 'Masala Chaas & Sweet Shrikhand Cup (Optional add-on)', category: 'salad_kachumber', description: 'Creamy cardamom shrikhand dessert bite', isJainAvailable: true }
      ],
      nutrition: {
        calories: 670,
        proteinGrams: 20,
        carbsGrams: 92,
        fatGrams: 18,
        fiberGrams: 14,
        oilLevel: 'Controlled'
      }
    },
    dinner: {
      title: 'Relaxed Saturday Comfort Night',
      chefNote: 'Light soothing khichdi with roasted papad and seasonal shaak.',
      items: [
        { id: 'sd1', name: 'Sev Dungri Nu Shaak', category: 'sabji', description: 'Spiced onion curry with crisp ratlami sev garnish', isJainAvailable: false },
        { id: 'sd2', name: 'Vagharli Toor Dal Khichdi with Desi Ghee', category: 'rice_khichdi', description: 'Steaming hot comfort bowl', isJainAvailable: true },
        { id: 'sd3', name: 'Kadhi with Methi Dana Tempered', category: 'dal_kadhi', description: 'Buttermilk soup with fenugreek seeds', isJainAvailable: true },
        { id: 'sd4', name: '3 Phulka Rotis', category: 'roti_bread', description: 'Light whole wheat rotis', isJainAvailable: true },
        { id: 'sd5', name: 'Roasted Papad & Mix Pickle', category: 'salad_kachumber', description: 'Authentic Gujarati pickle', isJainAvailable: true }
      ],
      nutrition: {
        calories: 525,
        proteinGrams: 16,
        carbsGrams: 77,
        fatGrams: 13,
        fiberGrams: 9,
        oilLevel: 'Very Low (Cold-Pressed)'
      }
    }
  },
  {
    dayOfWeek: 'Sunday',
    lunch: {
      title: 'Royal Sunday Gujarati Mahathali',
      chefNote: 'Our flagship celebratory lunch delivered to mark your weekly rest day.',
      items: [
        { id: 'su1', name: 'Paneer Butter Masala (Home Ground Spices)', category: 'sabji', description: 'Silky cashew-tomato gravy made without excessive butter', isJainAvailable: true, highlight: 'Sunday Special' },
        { id: 'su2', name: 'Chana Daal Dhokli / Bhindi Masala', category: 'sabji', description: 'Authentic savory delicacy cooked with mild tempering', isJainAvailable: true },
        { id: 'su3', name: 'Panchratna Dal with Ghee Tadka', category: 'dal_kadhi', description: 'Rich 5-lentil nutritious broth', isJainAvailable: true },
        { id: 'su4', name: '4 Whole Wheat Phulkas / Option for Missi Roti', category: 'roti_bread', description: 'Freshly roasted flatbreads', isJainAvailable: true },
        { id: 'su5', name: 'Saffron Jeera Rice with Fried Onions', category: 'rice_khichdi', description: 'Aromatic royal rice', isJainAvailable: true },
        { id: 'su6', name: 'Moong Dal Sheera Sweet Cup & Sweet Chaas', category: 'sweet', description: 'Traditional warm moong dal halwa in desi ghee', isJainAvailable: true }
      ],
      nutrition: {
        calories: 690,
        proteinGrams: 23,
        carbsGrams: 96,
        fatGrams: 19,
        fiberGrams: 12,
        oilLevel: 'Controlled'
      }
    },
    dinner: {
      title: 'Recharging Sunday Light Dinner',
      chefNote: 'Get ready for Monday feeling fresh, light and completely energized.',
      items: [
        { id: 'sud1', name: 'Gilodi Nu Shaak (Ivy Gourd / Tindora Fry)', category: 'sabji', description: 'Thinly sliced crispy tindora with crushed peanuts', isJainAvailable: true },
        { id: 'sud2', name: 'Moong Dal with Cumin & Curry Leaves', category: 'dal_kadhi', description: 'Light protein soup', isJainAvailable: true },
        { id: 'sud3', name: '4 Whole Wheat Phulkas', category: 'roti_bread', description: 'Soft and light', isJainAvailable: true },
        { id: 'sud4', name: 'Steamed Rice', category: 'rice_khichdi', description: 'Steamed fluffy rice', isJainAvailable: true },
        { id: 'sud5', name: 'Cucumber Kachumber & Ghee Jaggery Bite', category: 'salad_kachumber', description: 'Natural digestive sweet', isJainAvailable: true }
      ],
      nutrition: {
        calories: 495,
        proteinGrams: 17,
        carbsGrams: 74,
        fatGrams: 10,
        fiberGrams: 9,
        oilLevel: 'Very Low (Cold-Pressed)'
      }
    }
  }
];

export const DELIVERY_CLUSTERS: DeliveryCluster[] = [
  {
    id: 'cluster-a',
    name: 'Cluster A: Infocity & Student PG Belt',
    hubZone: 'Kudasan / Bhaijipura / PDPU Knowledge Corridor',
    targetAudience: 'Students (PDPU, GNLU, DA-IICT, NIFT), Interns & PG Residents',
    pincodes: ['382007', '382421', '382423'],
    keySectors: ['Infocity Phase 1 & 2', 'Kudasan', 'Bhaijipura', 'Raysan', 'PDPU Road', 'DA-IICT Area'],
    totalActiveSubscribers: 84,
    assignedVans: 3,
    lunchDispatchTime: '11:45 AM (Delivered 12:15 - 12:45 PM)',
    dinnerDispatchTime: '7:00 PM (Delivered 7:30 - 8:15 PM)',
    averageDeliveryDurationMinutes: 22,
    status: 'optimal'
  },
  {
    id: 'cluster-b',
    name: 'Cluster B: GIFT City & Tech Corridor',
    hubZone: 'GIFT City SEZ / Koba Circle / Tata Consultancy Belt',
    targetAudience: 'Finance executives, IT Engineers, Corporate Towers & Startups',
    pincodes: ['382355', '382009', '382010'],
    keySectors: ['GIFT SEZ Towers 1 & 2', 'GIFT Domestic Zone', 'Koba Highway', 'Randesan', 'Sargasan Cross Roads'],
    totalActiveSubscribers: 58,
    assignedVans: 2,
    lunchDispatchTime: '11:55 AM (Delivered 12:30 - 1:15 PM)',
    dinnerDispatchTime: '7:15 PM (Delivered 7:45 - 8:30 PM)',
    averageDeliveryDurationMinutes: 25,
    status: 'optimal'
  },
  {
    id: 'cluster-c',
    name: 'Cluster C: GIDC Electronics & Industrial Hub',
    hubZone: 'Sector 24 - 28 Industrial Estate',
    targetAudience: 'Factory teams, Shift supervisors, Plant engineers & SME offices',
    pincodes: ['382024', '382028', '382044'],
    keySectors: ['Sector 24 GIDC', 'Sector 25 Electronic Estate', 'Sector 26', 'Sector 28 Industrial Area'],
    totalActiveSubscribers: 36,
    assignedVans: 2,
    lunchDispatchTime: '11:30 AM (Delivered 12:00 - 12:30 PM for factory lunch sirens)',
    dinnerDispatchTime: '6:45 PM (Delivered 7:15 - 7:45 PM)',
    averageDeliveryDurationMinutes: 18,
    status: 'optimal'
  },
  {
    id: 'cluster-d',
    name: 'Cluster D: Central Sectors 1-30 & Sachivalaya',
    hubZone: 'Sector 11 / Sector 16 / Vidhan Sabha Belt',
    targetAudience: 'Government officers, Secretariat employees, Resident families & Senior citizens',
    pincodes: ['382010', '382016', '382021', '382022'],
    keySectors: ['Sector 1 to Sector 30 Residential Rows', 'Old & New Sachivalaya', 'CH Roads', 'Vavol'],
    totalActiveSubscribers: 64,
    assignedVans: 3,
    lunchDispatchTime: '11:40 AM (Delivered 12:15 - 1:00 PM)',
    dinnerDispatchTime: '7:10 PM (Delivered 7:40 - 8:30 PM)',
    averageDeliveryDurationMinutes: 20,
    status: 'optimal'
  }
];

export const MOCK_TRACEABILITY_MEAL: MealTraceabilityInfo = {
  mealId: 'GDM-2841',
  subscriptionId: 'SUB-GJ-9821',
  customerName: 'Aarav Patel (Student at PDPU)',
  menuSummary: ['Ringan No Olo', 'Sev Tameta Nu Shaak', 'Panchmel Dal Tadka', '4 Soft Phulka Rotis', 'Steamed Jeera Rice', 'Fresh Masala Chaas'],
  preparedTime: '10:42 AM',
  packedTime: '11:05 AM',
  dispatchTime: '11:20 AM',
  deliveredTime: '12:12 PM',
  currentStatus: 'delivered',
  kitchenLocation: 'Sample kitchen record — Gandhinagar',
  cookInCharge: 'Sample record — kitchen lead',
  hygieneInspector: 'Sample record — hygiene checklist reviewer',
  temperatureAtPacking: 'Sample record — temperature pending',
  clusterId: 'cluster-a',
  clusterName: 'Cluster A: Infocity & PDPU PG Hub',
  deliveryPartnerName: 'Jayeshbhai Solanki',
  deliveryPartnerPhone: '+91 94280 55123',
  estimatedDeliveryWindow: '12:00 PM - 12:30 PM'
};

export const INITIAL_USER_SUBSCRIPTION: UserSubscription = {
  id: 'SUB-GJ-9821',
  userId: 'USR-892',
  userName: 'Aarav Patel',
  userPhone: '+91 98254 99120',
  userEmail: 'aarav.patel.pdpu@gmail.com',
  userSegment: 'student',
  planId: 'half_month_15',
  planName: '15-Day Semester / Work Plan',
  slot: 'lunch',
  dietType: 'standard_gujarati',
  portionSize: 'regular',
  status: 'active',
  startDate: '2026-08-10',
  expiryDate: '2026-08-28',
  totalDays: 15,
  daysRemaining: 18, // as requested in specs: "Days Remaining: 18"
  mealsDeliveredCount: 8,
  pausedDates: ['2026-08-15'],
  skippedDates: ['2026-08-17'],
  deliveryAddress: {
    street: 'Room 402, Shivalik Elite Boys PG, Near Swagat Flamingo',
    area: 'Kudasan',
    sector: 'PDPU Knowledge Corridor',
    pincode: '382421',
    landmark: 'Behind Reliance Petrol Pump',
    clusterId: 'cluster-a',
    deliveryTimeSlot: '12:15 PM - 12:45 PM'
  },
  addons: {
    extraRoti: false,
    chaasDaily: true,
    sweetSunday: true
  },
  specialInstructions: 'Please leave with PG security guard if in lecture.'
};

export const MOCK_KITCHEN_BATCHES: KitchenBatch[] = [
  {
    id: 'BATCH-LUNCH-0821',
    slot: 'lunch',
    date: 'Today, 21 Aug',
    menuTitle: 'Ringan Olo & Sev Tameta Gujarati Thali',
    targetCount: 320,
    preparedCount: 280,
    packedCount: 245,
    dispatchedCount: 210,
    status: 'dispatching',
    headChef: 'Sample kitchen lead',
    startedAt: '06:30 AM',
    qualityPassed: true,
    oilUsageLog: 'Controlled 4.2ml cold-pressed groundnut oil per meal avg'
  },
  {
    id: 'BATCH-DINNER-0821',
    slot: 'dinner',
    date: 'Today, 21 Aug',
    menuTitle: 'Bhindi Sambhariya & Vagharli Khichdi Kadhi',
    targetCount: 260,
    preparedCount: 90,
    packedCount: 0,
    dispatchedCount: 0,
    status: 'in_prep',
    headChef: 'Sample kitchen lead',
    startedAt: '02:00 PM',
    qualityPassed: true,
    oilUsageLog: 'Pre-measured 3.8ml virgin peanut oil per batch'
  }
];

export const MOCK_CORPORATE_ACCOUNTS: CorporateAccount[] = [
  {
    id: 'CORP-GIFT-101',
    companyName: 'FinTech Pulse Technologies (GIFT SEZ)',
    contactPerson: 'Pooja Varma (HR Director)',
    phone: '+91 98980 44321',
    email: 'pooja.v@fintechpulse.com',
    location: 'Tower 1, 9th Floor, GIFT SEZ, Gandhinagar',
    employeeCount: 150,
    activeDailyMeals: 127,
    mealSlot: 'lunch',
    dietMix: {
      standardGujarati: 65,
      jainSatvik: 32,
      lowOilFit: 30
    },
    billingCycle: 'monthly',
    monthlySpend: 259080,
    contractStartDate: '2026-03-01',
    averageRating: 4.6,
    status: 'active'
  },
  {
    id: 'CORP-GIDC-204',
    companyName: 'Apex Precision Electronics Pvt Ltd',
    contactPerson: 'Maheshbhai Desai (Plant Manager)',
    phone: '+91 98240 88712',
    email: 'operations@apexprecision.in',
    location: 'Plot 412, Sector 25 Electronic Estate, Gandhinagar',
    employeeCount: 85,
    activeDailyMeals: 72,
    mealSlot: 'both',
    dietMix: {
      standardGujarati: 55,
      jainSatvik: 10,
      lowOilFit: 7
    },
    billingCycle: 'biweekly',
    monthlySpend: 195840,
    contractStartDate: '2026-01-15',
    averageRating: 4.7,
    status: 'active'
  }
];

export const CUSTOMER_FEEDBACKS: CustomerFeedback[] = [
  {
    id: 'FB-1',
    customerName: 'Priya Dave',
    customerRole: 'Student, DA-IICT (Kudasan PG)',
    sectorOrArea: 'Kudasan, Gandhinagar',
    mealId: 'GDM-2710',
    date: 'Yesterday',
    rating: 5,
    comment: 'Finally found a daily meal option that doesn’t feel like heavy oily restaurant food. The phulkas are soft just like home and the Chaas makes afternoons so much better!',
    positiveTags: ['Home-style Taste', 'Low Oil', 'Soft Phulkas', 'Punctual Delivery'],
    isFeaturedTestimonial: true
  },
  {
    id: 'FB-2',
    customerName: 'Hiren Trivedi',
    customerRole: 'HR Manager, GIFT City Tech Park',
    sectorOrArea: 'GIFT City, Gandhinagar',
    mealId: 'GDM-2688',
    date: '2 days ago',
    rating: 5,
    comment: 'The monthly subscription makes lunch hassle-free for our 60+ developers. The dashboard allows employees to skip days when working remotely without losing money.',
    positiveTags: ['Flexible Subscription', 'Hygienic Crates', 'Great Jain Options'],
    isFeaturedTestimonial: true
  },
  {
    id: 'FB-3',
    customerName: 'Sanjay Rathod',
    customerRole: 'Senior Production Supervisor, Sector 25 GIDC',
    sectorOrArea: 'Sector 25 GIDC, Gandhinagar',
    mealId: 'GDM-2650',
    date: '3 days ago',
    rating: 5,
    comment: 'Factory canteen food was inconsistent. Thalimitra delivers right at the 12:00 PM lunch whistle hot and fresh. Very reliable daily routine.',
    positiveTags: ['Hot Food', 'Punctual Dispatch', 'High Energy'],
    isFeaturedTestimonial: true
  },
  {
    id: 'FB-4',
    customerName: 'Bhavna Ben Patel',
    customerRole: 'Govt. Secretariat Resident, Sector 19',
    sectorOrArea: 'Sector 19, Gandhinagar',
    mealId: 'GDM-2592',
    date: '4 days ago',
    rating: 5,
    comment: 'Ordered for my elderly parents for their lunch routine. The food has zero excess oil, mild spices, and authentic kathiyawadi kadhi-khichdi taste.',
    positiveTags: ['Elderly Friendly', 'Controlled Spice', 'Zero Junk'],
    isFeaturedTestimonial: true
  }
];

export const GANDHINAGAR_AREAS = [
  { area: 'Infocity (Phase 1 & 2)', sector: 'Infocity Tech Hub', pincode: '382007', cluster: 'Cluster A: Student & Tech Belt', lunchSlot: '12:00 - 12:45 PM', dinnerSlot: '7:30 - 8:15 PM', activeUsers: 48 },
  { area: 'Kudasan', sector: 'Near Swagat Flamingo & Reliance Circle', pincode: '382421', cluster: 'Cluster A: Student & Tech Belt', lunchSlot: '12:15 - 12:45 PM', dinnerSlot: '7:30 - 8:15 PM', activeUsers: 36 },
  { area: 'Bhaijipura & Raysan', sector: 'PDPU Knowledge Corridor', pincode: '382423', cluster: 'Cluster A: Student & Tech Belt', lunchSlot: '12:20 - 12:50 PM', dinnerSlot: '7:40 - 8:20 PM', activeUsers: 29 },
  { area: 'GIFT City SEZ & Domestic', sector: 'GIFT Towers & Tech Zone', pincode: '382355', cluster: 'Cluster B: GIFT City Hub', lunchSlot: '12:30 - 1:15 PM', dinnerSlot: '7:45 - 8:30 PM', activeUsers: 58 },
  { area: 'Randesan & Sargasan', sector: 'Koba Highway Hub', pincode: '382009', cluster: 'Cluster B: GIFT City Hub', lunchSlot: '12:15 - 1:00 PM', dinnerSlot: '7:30 - 8:15 PM', activeUsers: 22 },
  { area: 'Sector 24, 25, 26, 28 GIDC', sector: 'Industrial & Electronic Estate', pincode: '382024', cluster: 'Cluster C: GIDC Factory Hub', lunchSlot: '11:45 AM - 12:30 PM', dinnerSlot: '7:00 - 7:45 PM', activeUsers: 36 },
  { area: 'Sector 1 to Sector 15', sector: 'Secretariat & Civil Enclaves', pincode: '382010', cluster: 'Cluster D: Central Gandhinagar', lunchSlot: '12:15 - 1:00 PM', dinnerSlot: '7:45 - 8:30 PM', activeUsers: 34 },
  { area: 'Sector 16 to Sector 30', sector: 'Residential & Market Sectors', pincode: '382016', cluster: 'Cluster D: Central Gandhinagar', lunchSlot: '12:15 - 1:00 PM', dinnerSlot: '7:45 - 8:30 PM', activeUsers: 30 },
  { area: 'Vavol & Kolavada', sector: 'West Gandhinagar', pincode: '382016', cluster: 'Cluster D: Central Gandhinagar', lunchSlot: '12:30 - 1:15 PM', dinnerSlot: '8:00 - 8:45 PM', activeUsers: 14 }
];

export const FAQS = [
  {
    q: 'How does Thalimitra differ from ordering on Swiggy or Zomato?',
    a: 'Thalimitra focuses on Kitchen-published home-style meals with the exact dish, price, cutoff and delivery window shown before each single order.'
  },
  {
    q: 'Do I need a subscription to order?',
    a: 'No. Paid subscriptions are not currently available. Choose a published Breakfast, Lunch or Dinner and place a single order only when you need it.'
  },
  {
    q: 'What if I just want to skip tomorrow’s lunch or dinner?',
    a: 'Simply tap "Skip Tomorrow" on your dashboard before 9:30 AM for lunch or 5:00 PM for dinner. The meal is saved in your credit balance and added as an extra day at the end of your billing cycle.'
  },
  {
    q: 'Is Jain Satvik food available without onion, garlic, or root vegetables?',
    a: 'Yes. We have a dedicated, separate Jain steam preparation counter in our central kitchen where strictly Jain Satvik meals (no onion, no garlic, no potato/root vegetables) are prepared with utmost sanctity.'
  },
  {
    q: 'What are the delivery timings in Gandhinagar?',
    a: 'Lunch is delivered between 12:00 PM – 1:00 PM (timed specifically for office/college break hours and factory shift sirens). Dinner is delivered between 7:30 PM – 8:30 PM warm in insulated food containers.'
  },
  {
    q: 'Do you support student groups, offices or factory teams?',
    a: 'Customers can place single orders from the published menu. Workplaces and larger groups can send an enquiry so serviceability, timing and commercial terms can be reviewed before any commitment.'
  },
  {
    q: 'How do you maintain hygiene and food quality?',
    a: 'Our Gandhinagar central steam kitchen strictly uses RO purified water for all cooking, triple-washed organic seasonal vegetables, cold-pressed groundnut oil, zero reused cooking fat, and food-grade heat-sealed recyclable meal trays with QR traceability codes.'
  }
];
