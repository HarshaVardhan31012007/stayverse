const sampleListings = [
  // ── Indian Properties (Warangal, Hyderabad & beyond) ──────────────────────
  {
    title: "Heritage Haveli near Warangal Fort",
    description: "Stay in a beautifully restored heritage haveli just minutes from the iconic Warangal Fort and Thousand Pillar Temple. Enjoy traditional Telangana architecture, courtyard garden, rooftop dining, and authentic Biryani experiences. Perfect for history enthusiasts and culture travelers.",
    image: {
      filename: "warangal-haveli",
      url: "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80"
    },
    price: 3200,
    location: "Warangal",
    country: "India",
    geometry: {
      type: "Point",
      coordinates: [79.5941, 17.9784] // Warangal, Telangana
    }
  },
  {
    title: "Lakeside Retreat at Pakhal Lake",
    description: "A peaceful lakeside cottage surrounded by lush forests of the Pakhal Wildlife Sanctuary near Warangal. Wake up to birdsong, enjoy morning boat rides on the pristine lake, and explore the stunning dam area. Ideal for nature lovers and birdwatchers.",
    image: {
      filename: "pakhal-lake",
      url: "https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=1200&q=80"
    },
    price: 2800,
    location: "Warangal",
    country: "India",
    geometry: {
      type: "Point",
      coordinates: [79.9000, 17.8500] // Pakhal Lake, near Warangal
    }
  },
  {
    title: "Modern Studio in Hanamkonda",
    description: "Sleek, fully air-conditioned studio apartment in the heart of Hanamkonda, twin-city of Warangal. Features high-speed WiFi, full kitchen, smart TV, and walking distance to cafés, restaurants, and historic temples. Perfect for business or leisure travel.",
    image: {
      filename: "hanamkonda-studio",
      url: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80"
    },
    price: 1800,
    location: "Warangal",
    country: "India",
    geometry: {
      type: "Point",
      coordinates: [79.5526, 18.0110] // Hanamkonda
    }
  },
  {
    title: "Luxury Villa in Hyderabad HITEC City",
    description: "Ultra-modern 3BHK luxury villa in the pulsating tech hub of HITEC City. Features private pool, landscaped garden, smart home automation, and proximity to Cybercafé, Mindspace, and Inorbit Mall. Perfect for corporate stays and weekend retreats.",
    image: {
      filename: "hyderabad-villa",
      url: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=80"
    },
    price: 8500,
    location: "Hyderabad",
    country: "India",
    geometry: {
      type: "Point",
      coordinates: [78.3736, 17.4435] // HITEC City, Hyderabad
    }
  },
  {
    title: "Boutique Guesthouse near Charminar",
    description: "Charming boutique guesthouse in the historic Old City district, a short walk from the iconic Charminar, Laad Bazaar, and Mecca Masjid. Experience authentic Hyderabadi culture, street food, and pearl jewelry shopping. Traditional rooftop seating with heritage views.",
    image: {
      filename: "charminar-guesthouse",
      url: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80"
    },
    price: 2500,
    location: "Hyderabad",
    country: "India",
    geometry: {
      type: "Point",
      coordinates: [78.4744, 17.3616] // Charminar, Hyderabad
    }
  },
  {
    title: "Beachfront Villa in North Goa",
    description: "Stunning Portuguese-style beachfront villa with private beach access in vibrant North Goa. Features infinity pool, open-air pavilion, outdoor barbecue, and just 5 minutes walk to Baga Beach and Calangute Beach clubs. Perfect for groups and beach lovers.",
    image: {
      filename: "goa-villa",
      url: "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=1200&q=80"
    },
    price: 12000,
    location: "Goa",
    country: "India",
    geometry: {
      type: "Point",
      coordinates: [73.7520, 15.5520] // North Goa, Baga Beach area
    }
  },
  {
    title: "Royal Palace Suite in Udaipur",
    description: "Live like royalty in this stunning heritage palace suite overlooking the shimmering Lake Pichola. Features hand-carved marble interiors, private lake-view terrace, traditional Rajasthani cuisine, and boat rides included. One of India's most romantic destinations.",
    image: {
      filename: "udaipur-palace",
      url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80"
    },
    price: 18000,
    location: "Udaipur",
    country: "India",
    geometry: {
      type: "Point",
      coordinates: [73.6850, 24.5854] // Udaipur, Rajasthan
    }
  },
  {
    title: "Houseboat Stay in Kerala Backwaters",
    description: "Experience the magic of Kerala backwaters from this traditional wooden houseboat (Kettuvallam). Cruise through emerald green canals, rice paddies, and coconut groves. Includes all meals with authentic Kerala seafood, WiFi, and AC bedrooms. A once-in-a-lifetime experience.",
    image: {
      filename: "kerala-houseboat",
      url: "https://images.unsplash.com/photo-1502784444187-359ac186c5bb?auto=format&fit=crop&w=1200&q=80"
    },
    price: 9500,
    location: "Alleppey",
    country: "India",
    geometry: {
      type: "Point",
      coordinates: [76.3388, 9.4981] // Alleppey (Alappuzha), Kerala
    }
  },
  {
    title: "Himalayan Chalet in Manali",
    description: "Cozy cedar wood chalet nestled in the snow-capped Himalayas near Manali. Perfect for adventure seekers — skiing, paragliding, and river rafting are minutes away. Features a log fireplace, private balcony with mountain views, and traditional Himachali meals.",
    image: {
      filename: "manali-chalet",
      url: "https://images.unsplash.com/photo-1605792657660-596af9009e82?auto=format&fit=crop&w=1200&q=80"
    },
    price: 6500,
    location: "Manali",
    country: "India",
    geometry: {
      type: "Point",
      coordinates: [77.1887, 32.2396] // Manali, Himachal Pradesh
    }
  },
  {
    title: "Yoga Ashram Retreat in Rishikesh",
    description: "Rejuvenate your soul at this serene yoga and wellness retreat on the banks of the holy Ganga river in Rishikesh. Daily meditation sessions, Ayurvedic spa treatments, vegetarian organic meals, and rafting adventures. The ultimate mind-body wellness escape in the yoga capital of the world.",
    image: {
      filename: "rishikesh-retreat",
      url: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80"
    },
    price: 4200,
    location: "Rishikesh",
    country: "India",
    geometry: {
      type: "Point",
      coordinates: [78.2676, 30.0869] // Rishikesh, Uttarakhand
    }
  },
  // ── International Properties ───────────────────────────────────────────────
  {
    title: "Cozy Beachfront Cottage",
    description: "Escape to this charming beachfront cottage for a relaxing getaway. Enjoy panoramic ocean views, private sundeck, and direct barefoot access to pristine sandy beaches.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?auto=format&fit=crop&w=1200&q=80"
    },
    price: 12500,
    location: "Malibu",
    country: "United States",
    geometry: {
      type: "Point",
      coordinates: [-118.7798, 34.0259]
    }
  },
  {
    title: "Modern Loft in Downtown",
    description: "Stay in the heart of the city in this stylish loft apartment. Featuring double-height exposed brick ceilings, floor-to-ceiling skyline windows, and high-speed fibre internet.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80"
    },
    price: 8500,
    location: "New York City",
    country: "United States",
    geometry: {
      type: "Point",
      coordinates: [-74.0060, 40.7128]
    }
  },
  {
    title: "Mountain Retreat",
    description: "Unplug and unwind in this peaceful alpine mountain cabin. Surrounded by nature, pine forests, an outdoor cedar hot tub, and stone wood-burning fireplace.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80"
    },
    price: 9500,
    location: "Aspen",
    country: "United States",
    geometry: {
      type: "Point",
      coordinates: [-106.8175, 39.1911]
    }
  },
  {
    title: "Historic Villa in Tuscany",
    description: "Experience the timeless charm of Tuscany in this beautifully restored 18th-century stone villa. Explore rolling olive groves, private vineyards, and sunset wine tastings.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80"
    },
    price: 22000,
    location: "Florence",
    country: "Italy",
    geometry: {
      type: "Point",
      coordinates: [11.2558, 43.7696]
    }
  },
  {
    title: "Secluded Treehouse Getaway",
    description: "Live among the majestic cedar treetops in this architectural treehouse retreat. Complete with wrap-around deck, skylight canopy views, and organic breakfast baskets.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80"
    },
    price: 7200,
    location: "Portland",
    country: "United States",
    geometry: {
      type: "Point",
      coordinates: [-122.6765, 45.5231]
    }
  },
  {
    title: "Beachfront Paradise",
    description: "Step out of your door onto white coral sands. This beachfront villa offers private infinity plunge pools, outdoor kitchen, and world-class snorkeling steps away.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=1200&q=80"
    },
    price: 16000,
    location: "Cancun",
    country: "Mexico",
    geometry: {
      type: "Point",
      coordinates: [-86.8515, 21.1619]
    }
  },
  {
    title: "Countryside Bed & Breakfast",
    description: "Charming stone B&B with a rustic modern feel, farm-to-table homemade breakfasts, estate vineyard tours, and tranquil lavender gardens.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80"
    },
    price: 5400,
    location: "Napa Valley",
    country: "United States",
    geometry: {
      type: "Point",
      coordinates: [-122.2869, 38.2975]
    }
  },
  {
    title: "Tropical Bungalow",
    description: "Private wooden bungalow surrounded by lush palm trees, frangipani blossoms, and private plunge pool. Ideal romantic hideaway with outdoor volcanic stone bath.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1496417263034-38ec4f0b665a?auto=format&fit=crop&w=1200&q=80"
    },
    price: 8900,
    location: "Bali",
    country: "Indonesia",
    geometry: {
      type: "Point",
      coordinates: [115.1889, -8.4095]
    }
  },
  {
    title: "Ski-In/Ski-Out Chalet",
    description: "Hit the snowy slopes right from your ski locker. Luxury alpine chalet featuring vaulted timber ceilings, outdoor heated hot tub, and panoramic glacier vistas.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1502784444187-359ac186c5bb?auto=format&fit=crop&w=1200&q=80"
    },
    price: 19500,
    location: "Whistler",
    country: "Canada",
    geometry: {
      type: "Point",
      coordinates: [-122.9574, 50.1163]
    }
  },
  {
    title: "Desert Glamping Tent",
    description: "Ultra-luxury safari tent situated in golden sand dunes. Features handwoven Moroccan rugs, private plunge pool, and gourmet dining beneath the Sahara starlight.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=1200&q=80"
    },
    price: 7800,
    location: "Sahara",
    country: "Morocco",
    geometry: {
      type: "Point",
      coordinates: [-3.0000, 24.0000]
    }
  },
  {
    title: "Luxury Penthouse",
    description: "Soar above the clouds with 360-degree skyline and sea views from this lavish high-floor penthouse. Complete with private elevator and infinity balcony terrace.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=80"
    },
    price: 32000,
    location: "Dubai",
    country: "UAE",
    geometry: {
      type: "Point",
      coordinates: [55.2708, 25.2048]
    }
  },
  {
    title: "Igloo Adventure Stay",
    description: "Spend an unforgettable night inside a thermal glass-roof igloo. Sleep under the dancing Northern Lights with cozy reindeer hides and heated oak flooring.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1605792657660-596af9009e82?auto=format&fit=crop&w=1200&q=80"
    },
    price: 15000,
    location: "Lapland",
    country: "Finland",
    geometry: {
      type: "Point",
      coordinates: [27.0000, 67.0000]
    }
  },
  {
    title: "Jungle Tree Villa",
    description: "Architect-designed luxury villa suspended high in the tropical canopy, overlooking cascading river ravines, private infinity edge pool, and yoga pavilion.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80"
    },
    price: 18000,
    location: "Ubud",
    country: "Indonesia",
    geometry: {
      type: "Point",
      coordinates: [115.2630, -8.5069]
    }
  },
  {
    title: "Clifftop Lighthouse Stay",
    description: "Wake to dramatic ocean surf crashing against rugged cliffs in this restored maritime lighthouse cottage. Private coastline trail and 360-degree lantern viewing room.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1523731407965-2430cd12f5e4?auto=format&fit=crop&w=1200&q=80"
    },
    price: 13500,
    location: "Cornwall",
    country: "United Kingdom",
    geometry: {
      type: "Point",
      coordinates: [-5.0560, 50.2660]
    }
  }
];

module.exports = { data: sampleListings };