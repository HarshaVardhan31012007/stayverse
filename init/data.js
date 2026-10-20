const sampleListings = [
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