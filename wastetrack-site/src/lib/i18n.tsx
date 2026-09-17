import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Lang = "fr" | "en";

const fr = {
  "nav.how": "Comment ça marche",
  "nav.features": "Fonctionnalités",
  "nav.collectors": "Collecteurs",
  "nav.plans": "Récompenses & Plans",
  "nav.impact": "Impact",
  "nav.faq": "FAQ",
  "nav.download": "Télécharger l'app",
  "nav.whatsapp": "Contact via WhatsApp",
  "nav.menu.open": "Ouvrir le menu",
  "nav.menu.close": "Fermer le menu",

  "hero.badge": "Ramassage intelligent de déchets",
  "hero.titleA": "Des quartiers propres,",
  "hero.titleB": "un ramassage à la fois.",
  "hero.subtitle":
    "WasteTrack connecte résidents et collecteurs : demandez un ramassage en quelques secondes, suivez le collecteur en direct sur la carte et gagnez des points à chaque geste eco-responsable.",
  "hero.ctaPrimary": "Commencer maintenant",
  "hero.ctaSecondary": "Découvrir comment ça marche",
  "hero.stat1": "de temps de réponse moyen",
  "hero.stat2": "ramassages effectués",
  "hero.stat3": "offerts au départ",
  "hero.marquee.household": "Déchets ménagers",
  "hero.marquee.plastic": "Plastiques",
  "hero.marquee.recyclable": "Recyclables",
  "hero.marquee.organic": "Organiques",
  "hero.marquee.electronic": "Électroniques",
  "hero.marquee.bulky": "Encombrants",
  "hero.mockup.pickupRunning": "Ramassage en cours",
  "hero.mockup.pickupDetail": "Déchets ménagers · Bonanjo",
  "hero.mockup.collector": "Collecteur",
  "hero.mockup.points50": "+50 points",
  "hero.mockup.pointsDone": "Ramassage terminé",

  "how.chip": "Comment ça marche",
  "how.title": "Trois étapes vers un quartier plus propre",
  "how.subtitle":
    "De la demande de ramassage à la récompense, WasteTrack simplifie toute la chaîne de gestion des déchets.",
  "how.s1.title": "Demandez votre ramassage",
  "how.s1.desc":
    "Choisissez le type de déchets, l'adresse et l'horaire. Votre demande est envoyée en quelques secondes aux collecteurs disponibles.",
  "how.s2.title": "Suivez en direct",
  "how.s2.desc":
    "Un collecteur accepte votre demande. Suivez son arrivée sur la carte avec l'ETA en temps réel, et recevez des notifications.",
  "how.s3.title": "Soyez récompensé",
  "how.s3.desc":
    "Chaque ramassage vous fait gagner des points échangeables contre des avantages. Votre quartier devient plus propre, vous êtes récompensé.",

  "feature.chip": "Pour les résidents",
  "feature.title": "Tout ce qu'il faut pour dire adieu aux déchets sauvages",
  "feature.subtitle":
    "Une application mobile tout-en-un pour gérer vos déchets du quotidien, du ramassage au signalement.",
  "feature.f1.title": "Ramassage à la demande",
  "feature.f1.desc":
    "Demandez un ramassage de déchets ménagers, plastiques, organiques ou électroniques en quelques secondes, où que vous soyez.",
  "feature.f2.title": "Planification flexible",
  "feature.f2.desc":
    "Planifiez vos ramassages à l'avance ou de manière récurrente. Vous restez maître de votre emploi du temps.",
  "feature.f3.title": "Suivi ETA en direct",
  "feature.f3.desc":
    "Visualisez le collecteur sur la carte en temps réel et suivez l'heure d'arrivée estimée, minute par minute.",
  "feature.f4.title": "Signalement d'incivilités",
  "feature.f4.desc":
    "Repérez un dépôt sauvage ? Signalez-le avec une photo et sa position. Les autorités et collecteurs interviennent plus vite.",
  "feature.f5.title": "Notifications en temps réel",
  "feature.f5.desc":
    "Restez informé à chaque étape : demande acceptée, collecteur en route, ramassage terminé. Zéro stress.",
  "feature.f6.title": "Applications disponibles en FR / EN",
  "feature.f6.desc":
    "WasteTrack est entièrement bilingue français / anglais, pensé pour les villes bilingues comme Douala.",

  "collector.badge": "Pour les collecteurs",
  "collector.title": "Transformez la collecte en une activité rentable.",
  "collector.subtitle":
    "WasteTrack vous met en relation avec des résidents de votre quartier et vous aide à organiser vos tournées plus efficacement qu'avec un carnet.",
  "collector.p1.title": "Des demandes en continu",
  "collector.p1.desc":
    "Recevez les demandes de ramassage des résidents de votre zone directement dans votre application.",
  "collector.p2.title": "Tournées optimisées",
  "collector.p2.desc":
    "L'application ordonne automatiquement vos arrêts via la meilleure route, pour moins de kilomètres et plus de ramassages.",
  "collector.p3.title": "Paiement tracé",
  "collector.p3.desc":
    "Chaque service est tracé : type de déchets, volume, coordonnées. Vous êtes payé de façon transparente.",
  "collector.p4.title": "Revenus récompensés",
  "collector.p4.desc":
    "Gagnez des points et des primes selon votre volume de collecte et la qualité du service rendu.",
  "collector.profileTitle": "Profil collecteur",
  "collector.zone": "Zone : Bonabéri",
  "collector.available": "Disponible",
  "collector.requests": "Demandes",
  "collector.points": "Points",
  "collector.rating": "Note",
  "collector.tourTitle": "Tournée du jour",
  "collector.tourOptimized": "Optimisée",
  "collector.pickupsCount": "3 ramassages",

  "plan.chip": "Récompenses & Plans",
  "plan.title": "Chaque geste compte, chaque geste rapporte",
  "plan.subtitle":
    "Un système de points qui valorise votre engagement, et des plans flexibles adaptés à vos besoins.",
  "plan.r1": "Chaque ramassage terminé",
  "plan.r2": "Signalement d'un dépôt sauvage",
  "plan.r3": "Parrainage d'un nouvel utilisateur",
  "plan.featured": "Le plus populaire",
  "plan.free.name": "Essentiel",
  "plan.free.price": "Gratuit",
  "plan.free.period": "pour toujours",
  "plan.free.desc": "L'essentiel pour commencer à recycler efficacement.",
  "plan.free.f1": "3 ramassages gratuits / mois",
  "plan.free.f2": "Suivi ETA en direct",
  "plan.free.f3": "Signalement d'incivilités",
  "plan.free.f4": "Cumul de points",
  "plan.free.cta": "Choisir Essentiel",
  "plan.plus.name": "Plus",
  "plan.plus.price": "1 500 FCFA",
  "plan.plus.period": "/ mois",
  "plan.plus.desc": "Pour les foyers actifs qui jettent plus de déchets.",
  "plan.plus.f1": "Ramassages illimités",
  "plan.plus.f2": "Planification récurrente",
  "plan.plus.f3": "Ramassages priorisés",
  "plan.plus.f4": "Bonus de points x2",
  "plan.plus.f5": "Support prioritaire",
  "plan.plus.cta": "Choisir Plus",
  "plan.pro.name": "Pro",
  "plan.pro.price": "3 500 FCFA",
  "plan.pro.period": "/ mois",
  "plan.pro.desc": "Pour les familles nombreuses et petites entreprises.",
  "plan.pro.f1": "Tout le plan Plus",
  "plan.pro.f2": "Ramassage de gros volumes",
  "plan.pro.f3": "Collecte électronique & encombrants",
  "plan.pro.f4": "Rapport d'impact mensuel",
  "plan.pro.f5": "Bonus de points x3",
  "plan.pro.cta": "Choisir Pro",
  "plan.note":
    "* Tarifs indicatifs de démonstration — contactez-nous pour les tarifs exacts de votre ville.",

  "edu.chip": "Éducation",
  "edu.title": "Apprenez les bons gestes, en toute simplicité",
  "edu.subtitle":
    "L'application intègre une section d'apprentissage avec des contenus simples et illustrés pour toute la famille : le tri, le compost, les filières de recyclage et la sécurité.",
  "edu.b1": "Contenus bilingues FR / EN",
  "edu.b2": "Mis à jour par l'équipe WasteTrack",
  "edu.b3": "Accessible hors connexion",
  "edu.l1.title": "Bien trier ses déchets",
  "edu.l1.desc":
    "Plastiques, organiques, métaux : apprenez les règles du tri pour maximiser le recyclage.",
  "edu.l1.tag": "Guide pratique",
  "edu.l2.title": "Composter à la maison",
  "edu.l2.desc":
    "Transformez vos déchets organiques en engrais naturel pour votre jardin ou vos plantes.",
  "edu.l2.tag": "Écologie",
  "edu.l3.title": "Comprendre les filières",
  "edu.l3.desc":
    "Que deviennent vos déchets après le ramassage ? Suivez le parcours complet jusqu'au recyclage.",
  "edu.l3.tag": "Pédagogie",
  "edu.l4.title": "Déchets dangereux : les bons réflexes",
  "edu.l4.desc":
    "Batteries, électronique, médicaments : les bons gestes pour ne pas polluer votre quartier.",
  "edu.l4.tag": "Sécurité",

  "stats.chip": "Impact",
  "stats.title": "Des résultats concrets, mesurables",
  "stats.subtitle":
    "Chaque utilisateur, chaque collecteur et chaque ramassage contribue à un environnement urbain plus sain.",
  "stats.s1": "ramassages effectués",
  "stats.s1.suffix": "tonnes détournées des dépôts sauvages",
  "stats.s2": "de demandes traitées en moins de 24 h",
  "stats.s2.suffix": "grâce à l'assignation en temps réel",
  "stats.s3": "points distribués chaque mois",
  "stats.s3.suffix": "à nos résidents engagés",
  "stats.s4": "utilisateurs actifs",
  "stats.s4.suffix": "à Douala et dans les villes voisines",

  "testi.chip": "Témoignages",
  "testi.title": "Ils ont adopté WasteTrack",
  "testi.subtitle":
    "Résidents et collecteurs racontent comment ils utilisent WasteTrack au quotidien.",
  "testi.q1":
    "Avant, mes déchets restaient des jours devant la maison. Maintenant je demande un ramassage depuis le lit et le collecteur arrive avec un pointage exact. C'est un changement de vie.",
  "testi.n1": "Aline M.",
  "testi.r1": "Résidente · Bonanjo",
  "testi.q2":
    "En tant que collecteur, je gagne plus en faisant moins de kilomètres. La tournée est déjà optimisée et je vois mes revenus en temps réel.",
  "testi.n2": "Serge K.",
  "testi.r2": "Collecteur · Akwa",
  "testi.q3":
    "Les points m'ont motivée, mes enfants aussi ! On trie ensemble et on utilise le crédit pour nos ramassages supplémentaires. Très facile à utiliser.",
  "testi.n3": "Mariette T.",
  "testi.r3": "Résidente · Bonapriso",

  "faq.title": "Questions fréquentes",
  "faq.subtitle": "Tout ce que vous devez savoir avant de rejoindre WasteTrack.",
  "faq.q1": "Dans quelles villes WasteTrack est-il disponible ?",
  "faq.a1":
    "WasteTrack est lancé à Douala (Cameroun) et s'étend progressivement aux villes voisines. Si votre quartier n'est pas encore couvert, contactez-nous, nous aimerions beaucoup l'ajouter.",
  "faq.q2": "Combien coûte l'utilisation de WasteTrack ?",
  "faq.a2":
    "Le plan Essentiel est gratuit avec 3 ramassages par mois et tout le système de points. Les plans Plus et Pro ajoutent des ramassages illimités, la planification et des bonus de points. Vous pouvez changer de plan à tout moment depuis l'application.",
  "faq.q3": "Comment fonctionne le système de points ?",
  "faq.a3":
    "Chaque ramassage terminé, signalement validé ou parrainage vous rapporte des points. Ces points peuvent être utilisés pour payer des ramassages supplémentaires ou des services, selon votre plan.",
  "faq.q4": "Comment devenir collecteur ?",
  "faq.a4":
    "Créez un compte dans l'application en choisissant le rôle « Collecteur », puis soumettez votre candidature. Après validation de votre profil et de votre équipement, vous recevrez des demandes de ramassage dans votre zone.",
  "faq.q5": "Comment sont rémunérés les collecteurs ?",
  "faq.a5":
    "Les collecteurs sont rémunérés par service rendu, de façon tracée et transparente dans l'application. Les primes et bonus (volume, qualité, rapidité) sont ajoutés automatiquement.",
  "faq.q6": "Que se passe-t-il si je signale un dépôt sauvage ?",
  "faq.a6":
    "Le signalement est transmis aux collecteurs et aux équipes de nettoyage de votre zone avec photo et position. Vous êtes notifié dès qu'une action est prise, et vous gagnez des points.",
  "faq.q7": "L'application est-elle disponible en anglais ?",
  "faq.a7":
    "Oui, WasteTrack est entièrement bilingue français / anglais. Vous pouvez basculer la langue à tout moment depuis les réglages.",

  "dl.title": "Prêt à rejoindre le mouvement ?",
  "dl.subtitle":
    "Téléchargez l'application WasteTrack et commencez à agir pour votre quartier : demandez un ramassage, suivez les collecteurs et gagnez des points dès aujourd'hui.",
  "dl.iosBadge": "Disponible sur",
  "dl.iosName": "App Store",
  "dl.androidName": "Google Play",
  "dl.scanTitle": "Scannez pour installer",
  "dl.scanDesc":
    "Pointez votre appareil photo sur ce QR code pour télécharger WasteTrack directement.",
  "dl.member": "Déjà membre ?",
  "dl.login": "Connectez-vous",

  "footer.tagline":
    "Le ramassage intelligent des déchets et le signalement d'incivilités pour des quartiers plus propres.",
  "footer.product": "Produit",
  "footer.resources": "Ressources",
  "footer.company": "Entreprise",
  "footer.f.how": "Comment ça marche",
  "footer.f.features": "Fonctionnalités",
  "footer.f.collectors": "Collecteurs",
  "footer.f.plans": "Récompenses & Plans",
  "footer.r.education": "Éducation",
  "footer.r.impact": "Impact",
  "footer.r.faq": "FAQ",
  "footer.r.download": "Téléchargement",
  "footer.c.admin": "Espace administrateur",
  "footer.c.partner": "Devenir partenaire",
  "footer.follow": "Suivez-nous",
  "footer.rights": "Tous droits réservés.",
  "footer.whatsapp": "Nous contacter sur WhatsApp",
};

const en: Record<keyof typeof fr, string> = {
  "nav.how": "How it works",
  "nav.features": "Features",
  "nav.collectors": "Collectors",
  "nav.plans": "Rewards & Plans",
  "nav.impact": "Impact",
  "nav.faq": "FAQ",
  "nav.download": "Download the app",
  "nav.whatsapp": "Contact via WhatsApp",
  "nav.menu.open": "Open menu",
  "nav.menu.close": "Close menu",

  "hero.badge": "Smart waste collection",
  "hero.titleA": "Cleaner neighborhoods,",
  "hero.titleB": "one pickup at a time.",
  "hero.subtitle":
    "WasteTrack connects residents and collectors: request a pickup in seconds, follow the collector live on the map and earn points with every eco-friendly action.",
  "hero.ctaPrimary": "Get started now",
  "hero.ctaSecondary": "Learn how it works",
  "hero.stat1": "average response time",
  "hero.stat2": "pickups completed",
  "hero.stat3": "welcome bonus",
  "hero.marquee.household": "Household waste",
  "hero.marquee.plastic": "Plastics",
  "hero.marquee.recyclable": "Recyclables",
  "hero.marquee.organic": "Organic waste",
  "hero.marquee.electronic": "E-waste",
  "hero.marquee.bulky": "Bulky items",
  "hero.mockup.pickupRunning": "Pickup in progress",
  "hero.mockup.pickupDetail": "Household waste · Bonanjo",
  "hero.mockup.collector": "Collector",
  "hero.mockup.points50": "+50 points",
  "hero.mockup.pointsDone": "Pickup completed",

  "how.chip": "How it works",
  "how.title": "Three steps to a cleaner neighborhood",
  "how.subtitle":
    "From pickup request to reward, WasteTrack simplifies the entire waste management chain.",
  "how.s1.title": "Request your pickup",
  "how.s1.desc":
    "Choose the waste type, address and time slot. Your request is sent to nearby collectors within seconds.",
  "how.s2.title": "Follow it live",
  "how.s2.desc":
    "A collector accepts your request. Track their arrival on the map with real-time ETA, and get notified at every step.",
  "how.s3.title": "Get rewarded",
  "how.s3.desc":
    "Every pickup earns you points you can redeem for perks. Your neighborhood gets cleaner, you get rewarded.",

  "feature.chip": "For residents",
  "feature.title": "Everything you need to say goodbye to illegal dumping",
  "feature.subtitle":
    "An all-in-one mobile app to manage your everyday waste, from pickup to reporting.",
  "feature.f1.title": "Pickup on demand",
  "feature.f1.desc":
    "Request a pickup for household, plastic, organic or electronic waste in seconds, wherever you are.",
  "feature.f2.title": "Flexible scheduling",
  "feature.f2.desc":
    "Schedule your pickups in advance or on a recurring basis. You stay in control of your calendar.",
  "feature.f3.title": "Live ETA tracking",
  "feature.f3.desc":
    "See the collector on the map in real time and follow the estimated arrival time, minute by minute.",
  "feature.f4.title": "Report illegal dumping",
  "feature.f4.desc":
    "Spotted a fly-tipping? Report it with a photo and location. Authorities and collectors act faster.",
  "feature.f5.title": "Real-time notifications",
  "feature.f5.desc":
    "Stay informed at every step: request accepted, collector on the way, pickup completed. Zero stress.",
  "feature.f6.title": "Available in EN / FR",
  "feature.f6.desc":
    "WasteTrack is fully bilingual English / French, built for bilingual cities like Douala.",

  "collector.badge": "For collectors",
  "collector.title": "Turn waste collection into a profitable business.",
  "collector.subtitle":
    "WasteTrack connects you with residents in your area and helps you run your routes far more efficiently than a notebook.",
  "collector.p1.title": "A steady flow of requests",
  "collector.p1.desc":
    "Receive pickup requests from residents in your zone straight into your app.",
  "collector.p2.title": "Optimized routes",
  "collector.p2.desc":
    "The app automatically orders your stops along the best route, for fewer kilometers and more pickups.",
  "collector.p3.title": "Tracked payments",
  "collector.p3.desc":
    "Every service is tracked: waste type, volume, coordinates. You get paid transparently.",
  "collector.p4.title": "Rewarded earnings",
  "collector.p4.desc":
    "Earn points and bonuses based on your collection volume and the quality of service delivered.",
  "collector.profileTitle": "Collector profile",
  "collector.zone": "Zone: Bonabéri",
  "collector.available": "Available",
  "collector.requests": "Requests",
  "collector.points": "Points",
  "collector.rating": "Rating",
  "collector.tourTitle": "Today's tour",
  "collector.tourOptimized": "Optimized",
  "collector.pickupsCount": "3 pickups",

  "plan.chip": "Rewards & Plans",
  "plan.title": "Every action counts, every action pays",
  "plan.subtitle":
    "A points system that rewards your engagement, plus flexible plans tailored to your needs.",
  "plan.r1": "Every completed pickup",
  "plan.r2": "Reporting illegal dumping",
  "plan.r3": "Referring a new user",
  "plan.featured": "Most popular",
  "plan.free.name": "Essentials",
  "plan.free.price": "Free",
  "plan.free.period": "forever",
  "plan.free.desc": "Everything you need to start recycling efficiently.",
  "plan.free.f1": "3 free pickups / month",
  "plan.free.f2": "Live ETA tracking",
  "plan.free.f3": "Report illegal dumping",
  "plan.free.f4": "Earn points",
  "plan.free.cta": "Choose Essentials",
  "plan.plus.name": "Plus",
  "plan.plus.price": "1,500 FCFA",
  "plan.plus.period": "/ month",
  "plan.plus.desc": "For active households that produce more waste.",
  "plan.plus.f1": "Unlimited pickups",
  "plan.plus.f2": "Recurring scheduling",
  "plan.plus.f3": "Priority pickups",
  "plan.plus.f4": "x2 points bonus",
  "plan.plus.f5": "Priority support",
  "plan.plus.cta": "Choose Plus",
  "plan.pro.name": "Pro",
  "plan.pro.price": "3,500 FCFA",
  "plan.pro.period": "/ month",
  "plan.pro.desc": "For large families and small businesses.",
  "plan.pro.f1": "Everything in Plus",
  "plan.pro.f2": "Large volume pickups",
  "plan.pro.f3": "E-waste & bulky collection",
  "plan.pro.f4": "Monthly impact report",
  "plan.pro.f5": "x3 points bonus",
  "plan.pro.cta": "Choose Pro",
  "plan.note":
    "* Demo pricing only — contact us for exact rates in your city.",

  "edu.chip": "Education",
  "edu.title": "Learn the right habits, effortlessly",
  "edu.subtitle":
    "The app includes a learning section with simple, illustrated content for the whole family: sorting, composting, recycling streams and safety.",
  "edu.b1": "Bilingual EN / FR content",
  "edu.b2": "Updated by the WasteTrack team",
  "edu.b3": "Available offline",
  "edu.l1.title": "Sorting waste properly",
  "edu.l1.desc":
    "Plastics, organics, metals: learn the sorting rules to maximize recycling.",
  "edu.l1.tag": "Practical guide",
  "edu.l2.title": "Composting at home",
  "edu.l2.desc":
    "Turn your organic waste into natural fertilizer for your garden or plants.",
  "edu.l2.tag": "Ecology",
  "edu.l3.title": "Understanding the streams",
  "edu.l3.desc":
    "What happens to your waste after collection? Follow the full journey to recycling.",
  "edu.l3.tag": "Learning",
  "edu.l4.title": "Hazardous waste: the right reflexes",
  "edu.l4.desc":
    "Batteries, electronics, medicine: the right moves to keep your neighborhood clean.",
  "edu.l4.tag": "Safety",

  "stats.chip": "Impact",
  "stats.title": "Concrete, measurable results",
  "stats.subtitle":
    "Every user, every collector and every pickup contributes to a healthier urban environment.",
  "stats.s1": "pickups completed",
  "stats.s1.suffix": "tons diverted from illegal dumps",
  "stats.s2": "of requests handled within 24 h",
  "stats.s2.suffix": "thanks to real-time assignment",
  "stats.s3": "points distributed every month",
  "stats.s3.suffix": "to our engaged residents",
  "stats.s4": "active users",
  "stats.s4.suffix": "in Douala and nearby cities",

  "testi.chip": "Testimonials",
  "testi.title": "They adopted WasteTrack",
  "testi.subtitle":
    "Residents and collectors share how they use WasteTrack every day.",
  "testi.q1":
    "Before, my waste stayed in front of the house for days. Now I request a pickup from bed and the collector arrives right on time. It's life-changing.",
  "testi.n1": "Aline M.",
  "testi.r1": "Resident · Bonanjo",
  "testi.q2":
    "As a collector, I earn more while driving fewer kilometers. The route is already optimized and I see my earnings in real time.",
  "testi.n2": "Serge K.",
  "testi.r2": "Collector · Akwa",
  "testi.q3":
    "The points motivated me and my kids too! We sort together and use the credit for our extra pickups. Very easy to use.",
  "testi.n3": "Mariette T.",
  "testi.r3": "Resident · Bonapriso",

  "faq.title": "Frequently asked questions",
  "faq.subtitle": "Everything you need to know before joining WasteTrack.",
  "faq.q1": "In which cities is WasteTrack available?",
  "faq.a1":
    "WasteTrack is live in Douala (Cameroon) and is expanding to nearby cities. If your area is not covered yet, contact us — we would love to add it.",
  "faq.q2": "How much does WasteTrack cost?",
  "faq.a2":
    "The Essentials plan is free with 3 pickups per month and the full points system. Plus and Pro add unlimited pickups, scheduling and points bonuses. You can switch plans anytime from the app.",
  "faq.q3": "How does the points system work?",
  "faq.a3":
    "Every completed pickup, validated report or referral earns you points. These points can be used to pay for extra pickups or services, depending on your plan.",
  "faq.q4": "How do I become a collector?",
  "faq.a4":
    "Create an account in the app and choose the « Collector » role, then submit your application. Once your profile and equipment are validated, you will receive pickup requests in your area.",
  "faq.q5": "How are collectors paid?",
  "faq.a5":
    "Collectors are paid per service, in a tracked and transparent way inside the app. Bonuses (volume, quality, speed) are added automatically.",
  "faq.q6": "What happens when I report illegal dumping?",
  "faq.a6":
    "The report is sent to collectors and cleaning teams in your area with photo and location. You are notified as soon as action is taken, and you earn points.",
  "faq.q7": "Is the app available in French?",
  "faq.a7":
    "Yes, WasteTrack is fully bilingual English / French. You can switch the language anytime from the settings.",

  "dl.title": "Ready to join the movement?",
  "dl.subtitle":
    "Download the WasteTrack app and start acting for your neighborhood: request a pickup, follow collectors and earn points starting today.",
  "dl.iosBadge": "Available on",
  "dl.iosName": "App Store",
  "dl.androidName": "Google Play",
  "dl.scanTitle": "Scan to install",
  "dl.scanDesc":
    "Point your camera at this QR code to download WasteTrack directly.",
  "dl.member": "Already a member?",
  "dl.login": "Log in",

  "footer.tagline":
    "Smart waste collection and reporting of illegal dumping for cleaner neighborhoods.",
  "footer.product": "Product",
  "footer.resources": "Resources",
  "footer.company": "Company",
  "footer.f.how": "How it works",
  "footer.f.features": "Features",
  "footer.f.collectors": "Collectors",
  "footer.f.plans": "Rewards & Plans",
  "footer.r.education": "Education",
  "footer.r.impact": "Impact",
  "footer.r.faq": "FAQ",
  "footer.r.download": "Download",
  "footer.c.admin": "Admin dashboard",
  "footer.c.partner": "Become a partner",
  "footer.follow": "Follow us",
  "footer.rights": "All rights reserved.",
  "footer.whatsapp": "Contact us on WhatsApp",
};

type Dict = typeof fr;

const dictionaries: Record<Lang, Dict> = { fr, en };

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: keyof Dict) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = "wastetrack-site-lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "fr";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "en" || stored === "fr" ? stored : "fr";
  });

  const setLang = (next: Lang) => {
    setLangState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.lang = next;
      document.title =
        next === "fr"
          ? "WasteTrack — Un ramassage de déchets intelligent pour des quartiers propres"
          : "WasteTrack — Smart waste collection for cleaner neighborhoods";
    }
  };

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value: LanguageContextValue = {
    lang,
    setLang,
    t: (key) => dictionaries[lang][key],
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}