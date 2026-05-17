// ===== DATA STORE =====
const AppData = {
  branches: [
    { id: 1, name: "สาขาสยาม", code: "BKK01", target: 500000, color: "#6366f1" },
    { id: 2, name: "สาขาอโศก", code: "BKK02", target: 400000, color: "#0ea5e9" },
    { id: 3, name: "สาขาลาดพร้าว", code: "BKK03", target: 350000, color: "#10b981" },
    { id: 4, name: "สาขาเชียงใหม่", code: "CNX01", target: 300000, color: "#f59e0b" },
  ],

  // ===== SOFA MATERIAL TYPES (4 grades) =====
  sofaMaterials: {
    fabric:  { name: "ผ้า",          icon: "🧵", priceMultiplier: 1.0,  surcharge: "ราคามาตรฐาน",         desc: "ผ้าหุ้มคุณภาพดี ทำความสะอาดได้" },
    pu:      { name: "หนัง PU",       icon: "🟫", priceMultiplier: 1.20, surcharge: "+20%",                desc: "หนังสังเคราะห์ คุ้มค่า ใช้งานง่าย" },
    mixed:   { name: "หนังผสม PU",    icon: "🟤", priceMultiplier: 1.50, surcharge: "+50%",                desc: "หนังจริง 30% + PU 70% ทนทานดีขึ้น" },
    genuine: { name: "หนังแท้ทั้งตัว", icon: "🏆", priceMultiplier: 2.20, surcharge: "+120%",               desc: "หนังวัวแท้ 100% เกรด Premium อายุ 20+ ปี" },
  },
  sofaColors: {
    fabric: [
      { code: "F01", name: "ขาวครีม",        hex: "#fef3c7" },
      { code: "F02", name: "เบจอ่อน",        hex: "#e7d4b3" },
      { code: "F03", name: "เบจกลาง",        hex: "#d4c5a9" },
      { code: "F04", name: "เทาอ่อน",        hex: "#d1d5db" },
      { code: "F05", name: "เทาหิน",         hex: "#9ca3af" },
      { code: "F06", name: "เทาเข้ม",        hex: "#6b7280" },
      { code: "F07", name: "ดำกราไฟท์",      hex: "#1f2937" },
      { code: "F08", name: "น้ำตาลกาแฟ",     hex: "#78350f" },
      { code: "F09", name: "น้ำตาลแดง",      hex: "#b45309" },
      { code: "F10", name: "แดงเชอร์รี่",     hex: "#b91c1c" },
      { code: "F11", name: "ส้มอิฐ",          hex: "#c2410c" },
      { code: "F12", name: "เหลืองมัสตาร์ด",  hex: "#ca8a04" },
      { code: "F13", name: "เขียวมอส",       hex: "#4a5e3a" },
      { code: "F14", name: "เขียวป่า",       hex: "#166534" },
      { code: "F15", name: "น้ำเงินเข้ม",     hex: "#1e3a5f" },
    ],
    pu: [
      { code: "P01", name: "ดำคลาสสิก",      hex: "#0f172a" },
      { code: "P02", name: "ดำกราไฟท์",      hex: "#1f2937" },
      { code: "P03", name: "น้ำตาลเข้ม",      hex: "#4c2a14" },
      { code: "P04", name: "น้ำตาลกลาง",     hex: "#78350f" },
      { code: "P05", name: "น้ำตาลส้ม",      hex: "#9a3412" },
      { code: "P06", name: "Tan",            hex: "#c9a96e" },
      { code: "P07", name: "ครีม",            hex: "#f5f0e8" },
      { code: "P08", name: "ขาว",             hex: "#fdf2e9" },
      { code: "P09", name: "แดงเลือดหมู",     hex: "#7f1d1d" },
      { code: "P10", name: "แดงสด",           hex: "#dc2626" },
      { code: "P11", name: "ส้ม",              hex: "#f97316" },
      { code: "P12", name: "น้ำเงินกรมท่า",   hex: "#1e3a8a" },
      { code: "P13", name: "เขียว",            hex: "#166534" },
      { code: "P14", name: "เทาควัน",         hex: "#4b5563" },
      { code: "P15", name: "ชมพู",             hex: "#db2777" },
    ],
    mixed: [
      { code: "M01", name: "Espresso",        hex: "#3f1f0a" },
      { code: "M02", name: "Mocha",           hex: "#5d3a1f" },
      { code: "M03", name: "Chestnut",        hex: "#78350f" },
      { code: "M04", name: "Cognac",          hex: "#92400e" },
      { code: "M05", name: "Saddle",          hex: "#b45309" },
      { code: "M06", name: "Caramel",         hex: "#c2761a" },
      { code: "M07", name: "Whiskey",         hex: "#a16207" },
      { code: "M08", name: "Camel",           hex: "#c9a96e" },
      { code: "M09", name: "Bone",            hex: "#e8dcc4" },
      { code: "M10", name: "Charcoal",        hex: "#1f2937" },
      { code: "M11", name: "Slate",           hex: "#475569" },
      { code: "M12", name: "Vintage Red",     hex: "#7f1d1d" },
      { code: "M13", name: "Forest",          hex: "#14532d" },
      { code: "M14", name: "Midnight",        hex: "#1e293b" },
      { code: "M15", name: "Steel",           hex: "#64748b" },
    ],
    genuine: [
      { code: "G01", name: "Onyx Black",       hex: "#0a0a0a" },
      { code: "G02", name: "Italian Brown",    hex: "#3d1f0a" },
      { code: "G03", name: "Tuscan Brown",     hex: "#5c2e0f" },
      { code: "G04", name: "Cognac Saddle",    hex: "#7c4017" },
      { code: "G05", name: "Burnished Tan",    hex: "#a16030" },
      { code: "G06", name: "Honey",            hex: "#c2761a" },
      { code: "G07", name: "Ivory Cream",      hex: "#f5edd6" },
      { code: "G08", name: "Pearl White",      hex: "#fafaf2" },
      { code: "G09", name: "Burgundy Wine",    hex: "#5f0f0a" },
      { code: "G10", name: "Oxblood",          hex: "#7c1010" },
      { code: "G11", name: "Mahogany",         hex: "#4a1a0a" },
      { code: "G12", name: "Royal Navy",       hex: "#0c1e3d" },
      { code: "G13", name: "Forest Emerald",   hex: "#053928" },
      { code: "G14", name: "Graphite",         hex: "#2d2d2d" },
      { code: "G15", name: "Dove Grey",        hex: "#8a8580" },
    ],
  },

  categories: [
    { id: "sofa",     code: "SF", name: "โซฟา",          icon: "🛋️", color: "#6366f1", nameEn: "Sofa" },
    { id: "bed",      code: "BD", name: "เตียง",          icon: "🛏️", color: "#0ea5e9", nameEn: "Bed" },
    { id: "table",    code: "TB", name: "โต๊ะ",           icon: "🪵", color: "#10b981", nameEn: "Table" },
    { id: "chair",    code: "CH", name: "เก้าอี้",        icon: "🪑", color: "#f59e0b", nameEn: "Chair" },
    { id: "cabinet",  code: "CB", name: "ตู้",            icon: "🗄️", color: "#ef4444", nameEn: "Cabinet" },
    { id: "lighting", code: "LT", name: "แสงสว่าง",       icon: "💡", color: "#8b5cf6", nameEn: "Lighting" },
    { id: "deco",     code: "DC", name: "ของตกแต่ง",      icon: "🖼️", color: "#ec4899", nameEn: "Decor" },
  ],

  products: [
    // SOFAS
    {
      id: "SF001", categoryId: "sofa", name: "โซฟา Luxe Nordic",
      description: "โซฟาสไตล์นอร์ดิก เลือกได้ทั้งผ้ากำมะหยี่และหนัง PU",
      price: 38900, cost: 21400, sku: "SF-LUX-001",
      materialTypes: ["fabric", "pu", "mixed", "genuine"],
      images: [
        "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80",
        "https://images.unsplash.com/photo-1567016432779-094069958ea5?w=600&q=80",
        "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=600&q=80",
        "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80",
      ],
      sizes: [
        { code: "2P", label: "2 ที่นั่ง", w: 160, d: 85, h: 82, seat_h: 46, room_min: "3×4m" },
        { code: "3P", label: "3 ที่นั่ง", w: 210, d: 85, h: 82, seat_h: 46, room_min: "4×4m" },
        { code: "4P-L", label: "L-Shape 4 ที่นั่ง", w: 270, d: 160, h: 82, seat_h: 46, room_min: "4×5m" },
      ],
      colors: [
        { code: "GRY", name: "เทาหิน", hex: "#9ca3af" },
        { code: "BEG", name: "เบจอ่อน", hex: "#d4c5a9" },
        { code: "NVY", name: "น้ำเงินเข้ม", hex: "#1e3a5f" },
        { code: "GRN", name: "เขียวมอส", hex: "#4a5e3a" },
      ],
      materials: {
        fabric: { name: "กำมะหยี่ Velvet", grade: "Grade A", origin: "เบลเยียม", properties: ["กันน้ำ", "ทำความสะอาดง่าย", "ทน UV", "ไม่ดูดฝุ่น"] },
        frame: { name: "ไม้ยางพาราแปรรูป", grade: "Grade AA", origin: "ไทย", properties: ["แข็งแรง", "ไม่แตกร้าว", "ทนปลวก", "อบความชื้น"] },
        foam: { name: "ฟองน้ำ HD", grade: "40 kg/m³", origin: "ไทย", properties: ["คืนตัวเร็ว", "รับน้ำหนักได้ดี", "อายุการใช้งาน 10+ ปี"] },
        legs: { name: "ขาไม้โอ๊ค", grade: "Solid Wood", origin: "อเมริกาเหนือ", properties: ["คงทน", "สวยงาม", "ปรับระดับได้"] },
      },
      stock: { 1: 8, 2: 5, 3: 12, 4: 3 },
      minStock: 3,
    },
    {
      id: "SF002", categoryId: "sofa", name: "โซฟา Comfort Plus",
      description: "โซฟาเบาะหนา 15cm เลือกได้ทั้งผ้าลินินและหนัง",
      price: 24500, cost: 14700, sku: "SF-COM-002",
      materialTypes: ["fabric", "pu", "mixed", "genuine"],
      images: [
        "https://images.unsplash.com/photo-1567016432779-094069958ea5?w=600&q=80",
        "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80",
      ],
      sizes: [
        { code: "1P", label: "1 ที่นั่ง", w: 90, d: 85, h: 80, seat_h: 44, room_min: "2×3m" },
        { code: "2P", label: "2 ที่นั่ง", w: 150, d: 85, h: 80, seat_h: 44, room_min: "3×4m" },
        { code: "3P", label: "3 ที่นั่ง", w: 200, d: 85, h: 80, seat_h: 44, room_min: "4×4m" },
      ],
      colors: [
        { code: "LGR", name: "เทาอ่อน", hex: "#d1d5db" },
        { code: "BRN", name: "น้ำตาล", hex: "#92400e" },
        { code: "WHT", name: "ขาวครีม", hex: "#fef3c7" },
      ],
      materials: {
        fabric: { name: "ผ้าลินิน Linen Blend", grade: "Grade B+", origin: "จีน (นำเข้า)", properties: ["ระบายอากาศดี", "นุ่ม", "ทำความสะอาดได้"] },
        frame: { name: "เหล็กกล้าชุบ", grade: "Steel 2mm", origin: "ไทย", properties: ["แข็งแรง", "น้ำหนักเบา", "ไม่เป็นสนิม"] },
        foam: { name: "ฟองน้ำ MD", grade: "32 kg/m³", origin: "ไทย", properties: ["นุ่ม", "ราคาดี", "อายุการใช้งาน 5-7 ปี"] },
        legs: { name: "ขาพลาสติก ABS", grade: "ABS Premium", origin: "ไทย", properties: ["เบา", "ทำความสะอาดง่าย"] },
      },
      stock: { 1: 15, 2: 10, 3: 7, 4: 20 },
      minStock: 5,
    },
    {
      id: "SF003", categoryId: "sofa", name: "โซฟา Modular Pro",
      description: "โซฟาโมดูลาร์ ปรับรูปทรงได้อิสระ เลือกหนังหรือผ้า Premium",
      price: 65000, cost: 33800, sku: "SF-MOD-003",
      materialTypes: ["fabric", "pu", "mixed", "genuine"],
      images: [
        "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=600&q=80",
        "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80",
      ],
      sizes: [
        { code: "3P", label: "3 Module", w: 240, d: 90, h: 85, seat_h: 48, room_min: "4×4m" },
        { code: "4P-L", label: "4 Module L-Shape", w: 300, d: 180, h: 85, seat_h: 48, room_min: "4×5m" },
        { code: "5P-U", label: "5 Module U-Shape", w: 340, d: 220, h: 85, seat_h: 48, room_min: "5×6m" },
      ],
      colors: [
        { code: "BLK", name: "ดำ", hex: "#1f2937" },
        { code: "WHT", name: "ขาวงาช้าง", hex: "#f5f0e8" },
        { code: "TAN", name: "น้ำตาลทอง", hex: "#c9a96e" },
      ],
      materials: {
        fabric: { name: "หนัง PU Premium", grade: "Grade S", origin: "อิตาลี", properties: ["ทนทาน", "ดูแลง่าย", "กันน้ำ", "ไม่ลอกง่าย"] },
        frame: { name: "ไม้สัก + เหล็ก", grade: "Hybrid Frame", origin: "ไทย/ญี่ปุ่น", properties: ["แข็งแรงสูงสุด", "ทนทาน 20+ ปี"] },
        foam: { name: "ฟองน้ำ Memory Foam", grade: "50 kg/m³", origin: "เกาหลี", properties: ["ตามทรงร่างกาย", "ระบายความร้อน", "ไม่ยุบ"] },
        legs: { name: "ขาสแตนเลส 304", grade: "SUS304", origin: "เกาหลี", properties: ["ไม่เป็นสนิม", "เงางาม", "ทนทาน"] },
      },
      stock: { 1: 3, 2: 2, 3: 1, 4: 4 },
      minStock: 2,
    },

    // BEDS
    {
      id: "BD001", categoryId: "bed", name: "เตียง Scandic Oak",
      description: "เตียงไม้โอ๊คแท้ สไตล์สแกนดิเนเวีย หัวเตียงบุนวม",
      price: 28900, cost: 16750, sku: "BD-SCA-001",
      images: ["https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=600&q=80"],
      sizes: [
        { code: "3FT", label: "3 ฟุต (Single)", w: 91, d: 200, h: 100, seat_h: 45, room_min: "3×4m" },
        { code: "5FT", label: "5 ฟุต (Queen)", w: 152, d: 200, h: 100, seat_h: 45, room_min: "4×5m" },
        { code: "6FT", label: "6 ฟุต (King)", w: 182, d: 200, h: 100, seat_h: 45, room_min: "4×5m" },
      ],
      colors: [
        { code: "NAT", name: "โอ๊คธรรมชาติ", hex: "#c8a97e" },
        { code: "WHT", name: "ขาว", hex: "#f5f5f5" },
      ],
      materials: {
        fabric: { name: "หนัง PU หัวเตียง", grade: "Grade A", origin: "ไทย", properties: ["นุ่ม", "ทำความสะอาดง่าย"] },
        frame: { name: "ไม้โอ๊คแท้", grade: "Solid Oak AA", origin: "อเมริกาเหนือ", properties: ["แข็งแรง", "ลายไม้สวย", "ทนทาน"] },
        foam: { name: "ฟองน้ำหัวเตียง", grade: "30 kg/m³", origin: "ไทย", properties: ["นุ่ม", "คืนรูป"] },
        legs: { name: "ขาไม้โอ๊ค", grade: "Solid Oak", origin: "อเมริกาเหนือ", properties: ["ทนทาน", "สวยงาม"] },
      },
      stock: { 1: 6, 2: 8, 3: 4, 4: 10 },
      minStock: 3,
    },
    {
      id: "BD002", categoryId: "bed", name: "เตียง Luxe Upholstered",
      description: "เตียงบุนวมทั้งคัน ผ้ากำมะหยี่ พร้อมลิ้นชักเก็บของ 4 ใบ",
      price: 42000, cost: 23100, sku: "BD-LUX-002",
      images: ["https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=600&q=80"],
      sizes: [
        { code: "5FT", label: "5 ฟุต (Queen)", w: 152, d: 200, h: 120, seat_h: 50, room_min: "4×5m" },
        { code: "6FT", label: "6 ฟุต (King)", w: 182, d: 200, h: 120, seat_h: 50, room_min: "4×6m" },
      ],
      colors: [
        { code: "GRY", name: "เทา", hex: "#6b7280" },
        { code: "BEG", name: "เบจ", hex: "#d4c5a9" },
        { code: "GRN", name: "เขียวป่า", hex: "#4a5e3a" },
      ],
      materials: {
        fabric: { name: "กำมะหยี่ Premium", grade: "Grade AA", origin: "เบลเยียม", properties: ["กันน้ำ", "ไม่ดูดฝุ่น", "ทำความสะอาดง่าย"] },
        frame: { name: "ไม้สน MDF เกรด E1", grade: "E1 Grade", origin: "นิวซีแลนด์", properties: ["แข็งแรง", "ไม่ปล่อยสาร", "เนียน"] },
        foam: { name: "ฟองน้ำหัวเตียงหนา 8cm", grade: "35 kg/m³", origin: "ไทย", properties: ["นุ่มมาก", "คงรูป"] },
        legs: { name: "ขาโลหะทอง", grade: "Alloy Gold", origin: "ไต้หวัน", properties: ["สวยงาม", "ทนทาน"] },
      },
      stock: { 1: 4, 2: 3, 3: 6, 4: 2 },
      minStock: 2,
    },

    // TABLES
    {
      id: "TB001", categoryId: "table", name: "โต๊ะกินข้าว Walnut",
      description: "โต๊ะไม้วอลนัทแท้ ขาเหล็กเส้น สไตล์ Industrial",
      price: 18500, cost: 11100, sku: "TB-WAL-001",
      images: ["https://images.unsplash.com/photo-1577140917170-285929fb55b7?w=600&q=80"],
      sizes: [
        { code: "4P", label: "4 ที่นั่ง (120cm)", w: 120, d: 70, h: 75, seat_h: 0, room_min: "3×4m" },
        { code: "6P", label: "6 ที่นั่ง (150cm)", w: 150, d: 80, h: 75, seat_h: 0, room_min: "3×5m" },
        { code: "8P", label: "8 ที่นั่ง (180cm)", w: 180, d: 90, h: 75, seat_h: 0, room_min: "4×5m" },
      ],
      colors: [
        { code: "DAR", name: "วอลนัทเข้ม", hex: "#5c3a1e" },
        { code: "MID", name: "วอลนัทกลาง", hex: "#8b5e3c" },
      ],
      materials: {
        fabric: { name: "—", grade: "—", origin: "—", properties: [] },
        frame: { name: "ไม้วอลนัทแท้", grade: "Solid Walnut AA", origin: "อเมริกาเหนือ", properties: ["ลายสวย", "ทนทาน", "มูลค่าสูง"] },
        foam: { name: "—", grade: "—", origin: "—", properties: [] },
        legs: { name: "เหล็กดำโรยทราย", grade: "Powder Coat", origin: "ไทย", properties: ["แข็งแรง", "ทนสนิม", "ดีไซน์"] },
      },
      stock: { 1: 12, 2: 8, 3: 15, 4: 6 },
      minStock: 4,
    },
    {
      id: "TB002", categoryId: "table", name: "โต๊ะกาแฟ Marble",
      description: "โต๊ะกาแฟหินอ่อนแท้ หนา 2cm ขาทองเหลือง",
      price: 12800, cost: 7950, sku: "TB-MAR-002",
      images: ["https://images.unsplash.com/photo-1592078615290-033ee584e267?w=600&q=80"],
      sizes: [
        { code: "SM", label: "เล็ก 60×60cm", w: 60, d: 60, h: 40, seat_h: 0, room_min: "2×3m" },
        { code: "MD", label: "กลาง 80×80cm", w: 80, d: 80, h: 42, seat_h: 0, room_min: "3×4m" },
        { code: "LG", label: "ใหญ่ 100×60cm", w: 100, d: 60, h: 42, seat_h: 0, room_min: "3×4m" },
      ],
      colors: [
        { code: "WHT", name: "หินขาว Carrara", hex: "#f0ece4" },
        { code: "BLK", name: "หินดำ Nero", hex: "#2c2c2c" },
      ],
      materials: {
        fabric: { name: "—", grade: "—", origin: "—", properties: [] },
        frame: { name: "หินอ่อนแท้ หนา 2cm", grade: "Grade A Marble", origin: "อิตาลี", properties: ["ลายสวย", "ทนทาน", "เย็น"] },
        foam: { name: "—", grade: "—", origin: "—", properties: [] },
        legs: { name: "ขาทองเหลืองแท้", grade: "Brass 70/30", origin: "ยุโรป", properties: ["ไม่เป็นสนิม", "สวยงาม"] },
      },
      stock: { 1: 5, 2: 3, 3: 8, 4: 2 },
      minStock: 2,
    },

    // CHAIRS
    {
      id: "CH001", categoryId: "chair", name: "เก้าอี้ Dining Arc",
      description: "เก้าอี้กินข้าว ไม้บีชแท้ บุนวม ขาโลหะ สไตล์ Japandi",
      price: 4800, cost: 3100, sku: "CH-ARC-001",
      images: ["https://images.unsplash.com/photo-1592078615290-033ee584e267?w=600&q=80","https://images.unsplash.com/photo-1503602642458-232111445657?w=600&q=80"],
      sizes: [
        { code: "STD", label: "มาตรฐาน 43×52×82cm", w: 43, d: 52, h: 82, seat_h: 46, room_min: "—" },
      ],
      colors: [
        { code: "NAT", name: "ไม้ธรรมชาติ", hex: "#d4a76a" },
        { code: "BLK", name: "ดำ", hex: "#1f2937" },
        { code: "WHT", name: "ขาว", hex: "#f5f5f5" },
      ],
      materials: {
        fabric: { name: "ผ้า Bouclé", grade: "Grade B", origin: "เดนมาร์ก", properties: ["กันน้ำ", "สวยงาม"] },
        frame: { name: "ไม้บีชแท้", grade: "Solid Beech A", origin: "เยอรมนี", properties: ["แข็งแรง", "เบา"] },
        foam: { name: "ฟองน้ำบาง 3cm", grade: "28 kg/m³", origin: "ไทย", properties: ["นุ่มเล็กน้อย"] },
        legs: { name: "ขาโลหะเหล็กดำ", grade: "Mild Steel", origin: "ไทย", properties: ["แข็งแรง"] },
      },
      stock: { 1: 24, 2: 32, 3: 16, 4: 40 },
      minStock: 8,
    },
    {
      id: "CH002", categoryId: "chair", name: "เก้าอี้ Lounge Shell",
      description: "เก้าอี้เลานจ์เปลือกหอย ไฟเบอร์กลาส เบาะหนัง ขาไม้",
      price: 9500, cost: 5500, sku: "CH-SHL-002",
      images: ["https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=600&q=80","https://images.unsplash.com/photo-1581539250439-c96689b516dd?w=600&q=80"],
      sizes: [
        { code: "STD", label: "มาตรฐาน 70×65×80cm", w: 70, d: 65, h: 80, seat_h: 42, room_min: "—" },
      ],
      colors: [
        { code: "RED", name: "แดง Tomato", hex: "#dc2626" },
        { code: "YEL", name: "เหลือง Mustard", hex: "#ca8a04" },
        { code: "GRN", name: "เขียว Sage", hex: "#6b9e7a" },
        { code: "WHT", name: "ขาวไข่มุก", hex: "#faf5f0" },
      ],
      materials: {
        fabric: { name: "หนัง PU", grade: "Grade A", origin: "ไต้หวัน", properties: ["ทำความสะอาดง่าย"] },
        frame: { name: "ไฟเบอร์กลาส FRP", grade: "Marine Grade", origin: "ไต้หวัน", properties: ["เบา", "ทนทาน", "ไม่แตกง่าย"] },
        foam: { name: "ฟองน้ำ HR", grade: "38 kg/m³", origin: "ไทย", properties: ["คืนตัวดี"] },
        legs: { name: "ขาไม้วอลนัท", grade: "Solid Walnut", origin: "อเมริกา", properties: ["สวยงาม"] },
      },
      stock: { 1: 10, 2: 6, 3: 14, 4: 8 },
      minStock: 4,
    },

    // CABINETS
    {
      id: "CB001", categoryId: "cabinet", name: "ตู้โชว์ Display Nordic",
      description: "ตู้โชว์กระจก 4 ชั้น โครงไม้สัก พร้อมไฟ LED",
      price: 15800, cost: 9500, sku: "CB-DIS-001",
      images: ["https://images.unsplash.com/photo-1616627052149-22c4f8a6f9c2?w=600&q=80","https://images.unsplash.com/photo-1611464908623-07f6e1a3a47e?w=600&q=80"],
      sizes: [
        { code: "SM", label: "เล็ก 60×35×180cm", w: 60, d: 35, h: 180, seat_h: 0, room_min: "—" },
        { code: "LG", label: "ใหญ่ 90×40×200cm", w: 90, d: 40, h: 200, seat_h: 0, room_min: "—" },
      ],
      colors: [
        { code: "WHT", name: "ขาว", hex: "#f5f5f5" },
        { code: "NAT", name: "ไม้ธรรมชาติ", hex: "#d4a76a" },
        { code: "BLK", name: "ดำ", hex: "#1f2937" },
      ],
      materials: {
        fabric: { name: "—", grade: "—", origin: "—", properties: [] },
        frame: { name: "ไม้สัก + MDF E0", grade: "Teak + E0 MDF", origin: "ไทย", properties: ["แข็งแรง", "ไม่ปล่อยสาร", "เนียน"] },
        foam: { name: "—", grade: "—", origin: "—", properties: [] },
        legs: { name: "ขาไม้สัก", grade: "Solid Teak", origin: "ไทย", properties: ["ทนทาน"] },
      },
      stock: { 1: 7, 2: 5, 3: 9, 4: 3 },
      minStock: 2,
    },

    // LIGHTING
    {
      id: "LT001", categoryId: "lighting", name: "โคมแขวน Rattan Dome",
      description: "โคมไฟหวาย Dome สไตล์ Tropical Boho",
      price: 2800, cost: 1800, sku: "LT-RAT-001",
      images: ["https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&q=80"],
      sizes: [
        { code: "SM", label: "เล็ก Ø40cm", w: 40, d: 40, h: 35, seat_h: 0, room_min: "—" },
        { code: "LG", label: "ใหญ่ Ø60cm", w: 60, d: 60, h: 50, seat_h: 0, room_min: "—" },
      ],
      colors: [
        { code: "NAT", name: "หวายธรรมชาติ", hex: "#d4a76a" },
        { code: "BLK", name: "หวายดำ", hex: "#3d3028" },
      ],
      materials: {
        fabric: { name: "—", grade: "—", origin: "—", properties: [] },
        frame: { name: "หวายแท้", grade: "Grade A Rattan", origin: "อินโดนีเซีย", properties: ["เบา", "สวยงาม", "ธรรมชาติ"] },
        foam: { name: "—", grade: "—", origin: "—", properties: [] },
        legs: { name: "สายไฟ Textile", grade: "EU Standard", origin: "ยุโรป", properties: ["ปลอดภัย", "สวยงาม"] },
      },
      stock: { 1: 20, 2: 15, 3: 25, 4: 30 },
      minStock: 8,
    },

    // DECO
    {
      id: "DC001", categoryId: "deco", name: "แจกันเซรามิก Nordic",
      description: "แจกันเซรามิกเคลือบ สไตล์นอร์ดิก Set 3 ชิ้น",
      price: 1890, cost: 1250, sku: "DC-VAS-001",
      images: ["https://images.unsplash.com/photo-1612196808214-b8e1d6145a8c?w=600&q=80"],
      sizes: [
        { code: "SET", label: "Set 3 ชิ้น (S/M/L)", w: 30, d: 15, h: 35, seat_h: 0, room_min: "—" },
      ],
      colors: [
        { code: "WHT", name: "ขาวเนื้อด้าน", hex: "#f5f0eb" },
        { code: "BEG", name: "เบจ-เทา", hex: "#c8b89a" },
        { code: "TER", name: "ดินเผา Terracotta", hex: "#c1603d" },
      ],
      materials: {
        fabric: { name: "—", grade: "—", origin: "—", properties: [] },
        frame: { name: "เซรามิกเคลือบ", grade: "Stoneware", origin: "เดนมาร์ก", properties: ["ทนทาน", "สวยงาม", "น้ำหนักดี"] },
        foam: { name: "—", grade: "—", origin: "—", properties: [] },
        legs: { name: "—", grade: "—", origin: "—", properties: [] },
      },
      stock: { 1: 30, 2: 20, 3: 35, 4: 25 },
      minStock: 10,
    },
  ],

  // Sales data (last 6 months per branch — current month is May 2026)
  salesHistory: {
    1: [510000, 445000, 490000, 528000, 472000, 142500],
    2: [380000, 345000, 402000, 412000, 388000, 98300],
    3: [320000, 295000, 355000, 368000, 340000, 115200],
    4: [290000, 268000, 310000, 322000, 298000, 76800],
  },
  months: ["ธ.ค.", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค."],

  // Today's sales (live simulation)
  todaySales: {
    1: { amount: 142500, count: 8, customers: 12 },
    2: { amount: 98300, count: 5, customers: 8 },
    3: { amount: 115200, count: 7, customers: 10 },
    4: { amount: 76800, count: 4, customers: 6 },
  },

  paymentMethods: [
    { id: "cash", name: "เงินสด", icon: "💵" },
    { id: "card", name: "บัตรเครดิต/เดบิต", icon: "💳" },
    { id: "transfer", name: "โอนเงิน", icon: "📱" },
    { id: "installment", name: "ผ่อนชำระ", icon: "📅" },
  ],

  reportEmails: [
    { id: 1, name: "คุณสมชาย (เจ้าของ)", email: "owner@furniture.co.th", role: "owner" },
    { id: 2, name: "คุณมาลี (ผจก.ใหญ่)", email: "manager@furniture.co.th", role: "manager" },
  ],
  reportSchedule: {
    days: [1, 2, 3, 4, 5],
    time: "20:00",
    channels: ["email", "line"],
    sections: ["summary", "stock_alert", "top_products", "ai_insight"],
  },
};

// ===== PASSWORD HASHING (demo: cyrb53 — production should use bcrypt/argon2 server-side) =====
function hashPassword(pwd, salt = "fh_2026_salt") {
  const str = salt + ":" + pwd;
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hash = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  return "fh$" + hash.padStart(16, "0");
}

// ===== AUDIT LOG =====
AppData.auditLog = [];

function logAction(action, details = {}) {
  AppData.auditLog.unshift({
    id: Date.now() + Math.random(),
    timestamp: new Date().toISOString(),
    userId: State?.currentUser?.id ?? null,
    userName: State?.currentUser?.name ?? "system",
    role: State?.currentUser?.role ?? "system",
    branchId: State?.currentBranch ?? null,
    action,
    details,
  });
  if (AppData.auditLog.length > 5000) AppData.auditLog.length = 5000;
}

// ===== MEMBERSHIP TIERS =====
AppData.tiers = {
  bronze:   { name: "Bronze",   color: "#a16207", icon: "🥉", multiplier: 1.0, threshold: 0,      perks: "1 pt / ฿100" },
  silver:   { name: "Silver",   color: "#64748b", icon: "🥈", multiplier: 1.5, threshold: 50000,  perks: "1.5 pt / ฿100" },
  gold:     { name: "Gold",     color: "#ca8a04", icon: "🥇", multiplier: 2.0, threshold: 200000, perks: "2 pt / ฿100 + ส่วนลด 5%" },
  platinum: { name: "Platinum", color: "#7c3aed", icon: "💎", multiplier: 3.0, threshold: 500000, perks: "3 pt / ฿100 + ส่วนลด 10% + จัดส่งฟรี" },
};

function getTierKey(totalSpent) {
  if (totalSpent >= 500000) return "platinum";
  if (totalSpent >= 200000) return "gold";
  if (totalSpent >= 50000)  return "silver";
  return "bronze";
}

function calcPointsEarned(amount, tier) {
  const t = AppData.tiers[tier] || AppData.tiers.bronze;
  return Math.floor(amount / 100 * t.multiplier);
}

// ===== CUSTOMERS =====
AppData.customers = [
  { id: 1, code: "CUST001", name: "คุณวิเชียร สำราญ", phone: "081-111-2222", email: "wichian@example.com", address: "123 สุขุมวิท 21 กทม. 10110", joinDate: "2024-01-15", totalSpent: 285000, totalOrders: 8, points: 5700, notes: "ชอบสไตล์ Modern · ห้องนั่งเล่นใหม่" },
  { id: 2, code: "CUST002", name: "คุณนภา รัตนะ", phone: "082-333-4444", email: "napa@example.com", address: "456 ลาดพร้าว 87 กทม. 10310", joinDate: "2023-09-08", totalSpent: 615000, totalOrders: 14, points: 18450, notes: "VIP · ซื้อใหญ่ทุกปี" },
  { id: 3, code: "CUST003", name: "คุณสมศักดิ์ ใจกล้า", phone: "083-555-6666", email: "somsak@example.com", address: "789 รามอินทรา กทม. 10220", joinDate: "2024-08-12", totalSpent: 78000, totalOrders: 3, points: 1170, notes: "" },
  { id: 4, code: "CUST004", name: "คุณปิยะ มงคล", phone: "084-777-8888", email: "piya@example.com", address: "321 พระราม 9 กทม. 10310", joinDate: "2024-11-20", totalSpent: 225000, totalOrders: 5, points: 4500, notes: "ขอจัดส่งช่วงเย็น" },
  { id: 5, code: "CUST005", name: "คุณพิมพ์ ดอกไม้", phone: "085-999-0000", email: "pim@example.com", address: "654 อโศก กทม. 10110", joinDate: "2025-02-03", totalSpent: 38000, totalOrders: 2, points: 380, notes: "" },
  { id: 6, code: "CUST006", name: "คุณกมล เกียรติ", phone: "086-123-4567", email: "kamon@example.com", address: "987 บางนา กทม. 10260", joinDate: "2024-05-22", totalSpent: 142000, totalOrders: 6, points: 2840, notes: "" },
  { id: 7, code: "CUST007", name: "คุณดวงใจ พิทักษ์", phone: "087-234-5678", email: "duangjai@example.com", address: "111 รัชดา กทม. 10310", joinDate: "2025-03-10", totalSpent: 18500, totalOrders: 1, points: 185, notes: "ลูกค้าใหม่" },
];

// ===== RECEIPTS (sale history for refund/void) =====
AppData.receipts = [];

// ===== QUOTATIONS =====
AppData.quotations = [];

// ===== Z-REPORTS (end-of-day snapshots) =====
AppData.zReports = [];

// ===== I18N =====
AppData.i18n = {
  th: {
    // App
    "app.name": "Furniture House",
    "app.subtitle": "ระบบ POS หลายสาขา",
    "app.online": "ออนไลน์",
    "app.offline": "ออฟไลน์",
    "app.version": "v1.0",
    // Auth
    "auth.login": "เข้าสู่ระบบ",
    "auth.logout": "ออกจากระบบ",
    "auth.username": "Username",
    "auth.password": "รหัสผ่าน",
    "auth.invalid": "Username หรือ Password ไม่ถูกต้อง",
    "auth.demoTitle": "ทดลองด้วย Demo Account",
    // Roles
    "role.owner": "เจ้าของกิจการ",
    "role.admin": "ผู้จัดการใหญ่",
    "role.manager": "ผู้จัดการสาขา",
    "role.cashier": "แคชเชียร์",
    "role.accountant": "ฝ่ายบัญชี",
    // Branch
    "branch.current": "สาขาที่ใช้งาน",
    "branch.warehouse": "คลังกลาง",
    "branch.cantSell": "ไม่ใช่หน้าร้าน",
    // Nav
    "nav.dashboard": "Dashboard",
    "nav.pos": "หน้าร้าน POS",
    "nav.quotations": "ใบเสนอราคา",
    "nav.customers": "ลูกค้า & สมาชิก",
    "nav.stock": "จัดการ Stock",
    "nav.products": "สินค้า & หมวดหมู่",
    "nav.receipts": "ใบเสร็จ & คืนสินค้า",
    "nav.delivery": "จัดส่งสินค้า",
    "nav.outstanding": "ยอดค้างชำระ",
    "nav.reports": "รายงานสาขา",
    "nav.zreport": "ปิดบัญชีประจำวัน",
    "nav.settings": "ตั้งค่าระบบ",
    "nav.section.main": "เมนูหลัก",
    "nav.section.customers": "ลูกค้า",
    "nav.section.manage": "จัดการ",
    "nav.section.system": "ระบบ",
    // Common buttons
    "btn.save": "💾 บันทึก",
    "btn.cancel": "ยกเลิก",
    "btn.edit": "✏️ แก้ไข",
    "btn.delete": "🗑️ ลบ",
    "btn.add": "+ เพิ่ม",
    "btn.confirm": "✅ ยืนยัน",
    "btn.close": "ปิด",
    "btn.export": "📥 Export",
    "btn.import": "📤 Import",
    "btn.search": "ค้นหา",
    "btn.next": "ถัดไป ›",
    "btn.prev": "‹ ก่อนหน้า",
    "btn.today": "วันนี้",
    // Common labels
    "label.name": "ชื่อ",
    "label.phone": "เบอร์โทร",
    "label.email": "Email",
    "label.address": "ที่อยู่",
    "label.note": "หมายเหตุ",
    "label.date": "วันที่",
    "label.time": "เวลา",
    "label.status": "สถานะ",
    "label.actions": "จัดการ",
    "label.total": "ยอดรวม",
    "label.subtotal": "ยอดย่อย",
    "label.vat": "VAT 7%",
    "label.discount": "ส่วนลด",
    "label.qty": "จำนวน",
    "label.price": "ราคา",
    "label.cost": "ต้นทุน",
    "label.amount": "ยอด",
    "label.branch": "สาขา",
    "label.customer": "ลูกค้า",
    "label.cashier": "แคชเชียร์",
    "label.payment": "วิธีชำระ",
    "label.all": "ทั้งหมด",
    // Dashboard
    "dash.todaySales": "ยอดขายวันนี้ (ทุกสาขา)",
    "dash.orders": "จำนวนออเดอร์วันนี้",
    "dash.customers": "ลูกค้าวันนี้",
    "dash.avgTicket": "ค่าเฉลี่ยต่อออเดอร์",
    "dash.salesByBranch": "ยอดขายแต่ละสาขา วันนี้",
    "dash.lowStockAlert": "⚠️ แจ้งเตือน Stock ต่ำ",
    "dash.noLowStock": "ไม่มีสินค้าสต็อกต่ำ",
    "dash.monthlySales": "ยอดขายรายเดือน",
    "dash.topProducts": "🏆 สินค้าขายดีประจำเดือน",
    // POS
    "pos.cart": "🛒 บิลปัจจุบัน",
    "pos.empty": "ยังไม่มีสินค้า",
    "pos.checkout": "💳 ชำระเงิน",
    "pos.attachCustomer": "👤 เพิ่มลูกค้าให้บิลนี้",
    "pos.delivery": "🚚 การจัดส่ง",
    "pos.useDeposit": "💵 รับเงินมัดจำเท่านั้น",
    "pos.outOfStock": "❌ หมด",
    "pos.inStock": "✓ มีสินค้า",
    // Months
    "month.long": ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"],
    "day.short": ["อา","จ","อ","พ","พฤ","ศ","ส"],
    "day.long": ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"],
    // Permission
    "perm.denied.title": "ไม่มีสิทธิ์เข้าถึงหน้านี้",
    "perm.denied.subtitle": "บทบาทของคุณไม่ได้รับสิทธิ์",
    "perm.denied.contact": "โปรดติดต่อผู้ดูแลระบบ",
  },
  en: {
    // App
    "app.name": "Furniture House",
    "app.subtitle": "Multi-Branch POS System",
    "app.online": "Online",
    "app.offline": "Offline",
    "app.version": "v1.0",
    // Auth
    "auth.login": "Sign In",
    "auth.logout": "Logout",
    "auth.username": "Username",
    "auth.password": "Password",
    "auth.invalid": "Invalid username or password",
    "auth.demoTitle": "Try Demo Account",
    // Roles
    "role.owner": "Owner",
    "role.admin": "Admin",
    "role.manager": "Branch Manager",
    "role.cashier": "Cashier",
    "role.accountant": "Accountant",
    // Branch
    "branch.current": "Current Branch",
    "branch.warehouse": "Warehouse",
    "branch.cantSell": "Storage only — no sales",
    // Nav
    "nav.dashboard": "Dashboard",
    "nav.pos": "POS",
    "nav.quotations": "Quotations",
    "nav.customers": "Customers & Loyalty",
    "nav.stock": "Stock",
    "nav.products": "Products & Categories",
    "nav.receipts": "Receipts & Refunds",
    "nav.delivery": "Delivery",
    "nav.outstanding": "Outstanding Balance",
    "nav.reports": "Branch Reports",
    "nav.zreport": "Daily Z-Report",
    "nav.settings": "Settings",
    "nav.section.main": "Main",
    "nav.section.customers": "Customer",
    "nav.section.manage": "Management",
    "nav.section.system": "System",
    // Common
    "btn.save": "💾 Save",
    "btn.cancel": "Cancel",
    "btn.edit": "✏️ Edit",
    "btn.delete": "🗑️ Delete",
    "btn.add": "+ Add",
    "btn.confirm": "✅ Confirm",
    "btn.close": "Close",
    "btn.export": "📥 Export",
    "btn.import": "📤 Import",
    "btn.search": "Search",
    "btn.next": "Next ›",
    "btn.prev": "‹ Previous",
    "btn.today": "Today",
    // Labels
    "label.name": "Name",
    "label.phone": "Phone",
    "label.email": "Email",
    "label.address": "Address",
    "label.note": "Note",
    "label.date": "Date",
    "label.time": "Time",
    "label.status": "Status",
    "label.actions": "Actions",
    "label.total": "Total",
    "label.subtotal": "Subtotal",
    "label.vat": "VAT 7%",
    "label.discount": "Discount",
    "label.qty": "Qty",
    "label.price": "Price",
    "label.cost": "Cost",
    "label.amount": "Amount",
    "label.branch": "Branch",
    "label.customer": "Customer",
    "label.cashier": "Cashier",
    "label.payment": "Payment",
    "label.all": "All",
    // Dashboard
    "dash.todaySales": "Today's Sales (All Branches)",
    "dash.orders": "Today's Orders",
    "dash.customers": "Today's Customers",
    "dash.avgTicket": "Avg Order Value",
    "dash.salesByBranch": "Sales by Branch Today",
    "dash.lowStockAlert": "⚠️ Low Stock Alerts",
    "dash.noLowStock": "All stock levels are normal",
    "dash.monthlySales": "Monthly Sales",
    "dash.topProducts": "🏆 Top Products This Month",
    // POS
    "pos.cart": "🛒 Current Bill",
    "pos.empty": "No items yet",
    "pos.checkout": "💳 Checkout",
    "pos.attachCustomer": "👤 Attach Customer to Bill",
    "pos.delivery": "🚚 Delivery",
    "pos.useDeposit": "💵 Take deposit only",
    "pos.outOfStock": "❌ Out of stock",
    "pos.inStock": "✓ In stock",
    // Months
    "month.long": ["January","February","March","April","May","June","July","August","September","October","November","December"],
    "day.short": ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    "day.long": ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    // Permission
    "perm.denied.title": "Access Denied",
    "perm.denied.subtitle": "Your role doesn't have permission",
    "perm.denied.contact": "Please contact your system administrator",
  },
};

// Translation helper
function t(key, fallback) {
  const lang = State?.language || "th";
  const dict = AppData.i18n[lang] || AppData.i18n.th;
  return dict[key] !== undefined ? dict[key] : (fallback !== undefined ? fallback : key);
}

// ===== APP SETTINGS =====
AppData.appSettings = {
  requireCustomer: "off",        // off | warn | block — bind customer to bill
  requireCustomerForDelivery: true, // delivery always needs customer
  darkMode: false,
  defaultDepositPercent: 30,
  quotationValidDays: 14,
  enableRealtimeSync: true,
};

// ===== DAILY REPORT CONFIG =====
AppData.dailyReport = {
  enabled: true,
  time: "21:00",  // HH:MM 24-hour
  days: [1, 2, 3, 4, 5, 6, 0],  // 0=Sun..6=Sat (default: every day)
  channels: ["email", "line"],
  sections: ["summary", "branches", "stock_alert", "top_products", "ai_insight"],
  emailRecipients: [
    { id: 1, name: "คุณสมชาย (เจ้าของ)",      email: "owner@furniture.co.th",   enabled: true },
    { id: 2, name: "คุณมาลี (ผจก.ใหญ่)",       email: "manager@furniture.co.th", enabled: true },
    { id: 3, name: "คุณสุภา (บัญชี)",          email: "finance@furniture.co.th", enabled: true },
  ],
  lineToken: "",  // LINE Notify token (would be set in production)
  lineGroups: [
    { id: 1, name: "กลุ่มผู้บริหาร",           token: "**hidden**", enabled: true },
    { id: 2, name: "กลุ่มผู้จัดการสาขา",       token: "**hidden**", enabled: true },
  ],
  lastSentAt: null,
};

// ===== DAILY REPORT HISTORY =====
AppData.dailyReportHistory = [];

// ===== DELIVERY =====
AppData.deliveryZones = [
  { id: "pickup",       name: "🏪 ลูกค้ารับเอง",          fee: 0,    leadDays: 0, color: "#64748b" },
  { id: "bkk_inner",    name: "🛵 กทม. ชั้นใน",            fee: 300,  leadDays: 1, color: "#10b981" },
  { id: "bkk_outer",    name: "🛵 กทม. รอบนอก",            fee: 500,  leadDays: 2, color: "#0ea5e9" },
  { id: "metro",        name: "🚚 ปริมณฑล (นนท์/สมุทรปราการ/ปทุม)", fee: 800,  leadDays: 2, color: "#6366f1" },
  { id: "central",      name: "🚚 ภาคกลาง",                fee: 1500, leadDays: 3, color: "#a855f7" },
  { id: "upcountry",    name: "🚛 ต่างจังหวัด",             fee: 2500, leadDays: 5, color: "#ec4899" },
  { id: "express",      name: "⚡ ด่วนพิเศษ (ภายในวัน กทม.)", fee: 800,  leadDays: 0, color: "#f59e0b" },
  { id: "custom",       name: "💰 กำหนดราคาเอง",            fee: 0,    leadDays: 2, color: "#dc2626", custom: true, requiresPerm: "delivery.custom_price" },
];

AppData.deliveryStatuses = {
  pending:    { name: "รอชำระเงิน",    color: "#9ca3af", icon: "⏳" },
  scheduled:  { name: "นัดส่งแล้ว",     color: "#0ea5e9", icon: "📅" },
  preparing:  { name: "กำลังเตรียม",    color: "#a855f7", icon: "📦" },
  in_transit: { name: "กำลังจัดส่ง",    color: "#f59e0b", icon: "🚚" },
  delivered:  { name: "ส่งสำเร็จ",      color: "#16a34a", icon: "✅" },
  failed:     { name: "ส่งไม่สำเร็จ",   color: "#dc2626", icon: "❌" },
  cancelled:  { name: "ยกเลิก",         color: "#6b7280", icon: "🚫" },
};

AppData.deliveryTimeSlots = [
  { id: "morning",   name: "ช่วงที่ 1 (09:00-11:00)", short: "09-11", icon: "🌅", color: "#fbbf24" },
  { id: "afternoon", name: "ช่วงที่ 2 (11:00-14:00)", short: "11-14", icon: "☀️", color: "#f59e0b" },
  { id: "evening",   name: "ช่วงที่ 3 (15:00-18:00)", short: "15-18", icon: "🌆", color: "#a855f7" },
  { id: "anytime",   name: "ไม่ระบุเวลา",             short: "—",     icon: "🕐", color: "#6b7280" },
];

AppData.drivers = [
  { id: 1, name: "คุณสมหวัง รถเร็ว",  phone: "090-111-2222", vehicle: "กระบะ 1 ตัน",     license: "บ-1234", available: true },
  { id: 2, name: "คุณวิเชียร ขนส่ง",   phone: "090-333-4444", vehicle: "6 ล้อ",            license: "บ-5678", available: true },
  { id: 3, name: "คุณภาณุ ส่งไว",       phone: "090-555-6666", vehicle: "กระบะ 4 ประตู",   license: "บ-9012", available: true },
  { id: 4, name: "คุณวินัย ขับดี",      phone: "090-777-8888", vehicle: "กระบะ 1 ตัน",     license: "บ-3456", available: true },
  { id: 5, name: "คุณนิรันดร์ ปลอดภัย", phone: "090-999-0000", vehicle: "10 ล้อ",           license: "บ-7890", available: true },
];

// ===== DELIVERY CHANNELS (in-house + 3rd party couriers) =====
AppData.deliveryChannels = [
  {
    id: "inhouse",
    name: "ทีมจัดส่งของบริษัท",
    icon: "🚛",
    type: "inhouse",          // inhouse | postal | courier
    trackingPrefix: "TRK-",
    color: "#6366f1",
    supportsCOD: true,
    supportsScheduledDate: true,
    needsTeam: true,
    description: "ทีมจัดส่งของบริษัท · ปรับเวลาได้ · เก็บ COD ได้",
    websiteTrackUrl: null,
    active: true,
  },
  {
    id: "thaipost",
    name: "ไปรษณีย์ไทย",
    icon: "📮",
    type: "postal",
    trackingPrefix: "EMS-",
    color: "#dc2626",
    supportsCOD: true,
    supportsScheduledDate: false,
    needsTeam: false,
    description: "ไปรษณีย์ไทย EMS · ส่งทั่วประเทศ · ติดตามทาง track.thailandpost.co.th",
    websiteTrackUrl: "https://track.thailandpost.co.th/?trackNumber=",
    active: true,
  },
  {
    id: "kerry",
    name: "Kerry Express",
    icon: "🟧",
    type: "courier",
    trackingPrefix: "KER-",
    color: "#f97316",
    supportsCOD: true,
    supportsScheduledDate: false,
    needsTeam: false,
    description: "Kerry Express · ส่งด่วน 1-2 วัน · เช็ค track ที่ th.kerryexpress.com",
    websiteTrackUrl: "https://th.kerryexpress.com/th/track/?track=",
    active: true,
  },
  {
    id: "flash",
    name: "Flash Express",
    icon: "⚡",
    type: "courier",
    trackingPrefix: "FLE-",
    color: "#eab308",
    supportsCOD: true,
    supportsScheduledDate: false,
    needsTeam: false,
    description: "Flash Express · ส่งทั่วไทย ราคาประหยัด",
    websiteTrackUrl: "https://www.flashexpress.com/fle/tracking?se=",
    active: true,
  },
  {
    id: "jt",
    name: "J&T Express",
    icon: "🟥",
    type: "courier",
    trackingPrefix: "JT-",
    color: "#b91c1c",
    supportsCOD: true,
    supportsScheduledDate: false,
    needsTeam: false,
    description: "J&T Express · ส่งทั่วประเทศ + COD",
    websiteTrackUrl: "https://www.jtexpress.co.th/index/query/gzquery.html?bills=",
    active: true,
  },
  {
    id: "lalamove",
    name: "Lalamove",
    icon: "🛵",
    type: "courier",
    trackingPrefix: "LMV-",
    color: "#fb923c",
    supportsCOD: false,
    supportsScheduledDate: true,
    needsTeam: false,
    description: "Lalamove · ส่งด่วนภายในเมือง · เลือกขนาดรถได้",
    websiteTrackUrl: "https://www.lalamove.com/thailand/th/order/",
    active: true,
  },
];

// ===== DELIVERY TEAMS (in-house) =====
// slotCapacity = jobs per time slot (morning/afternoon/evening)
// capacityPerDay = total jobs per day (= slotCapacity × 3 by default)
AppData.deliveryTeams = [
  {
    id: 1, name: "ทีม A - กทม. ชั้นใน",
    region: "bkk_inner", color: "#6366f1",
    driverIds: [1, 4],
    helpers: ["คุณวีระ ผู้ช่วย", "คุณสมศักดิ์ ผู้ช่วย"],
    vehicle: "6 ล้อ + กระบะ",
    slotCapacity: 2,        // 2 jobs per time slot
    capacityPerDay: 6,      // 2 × 3 slots = 6 jobs/day
    branchId: 1,
    active: true,
    notes: "พร้อมขึ้นชั้น 5 / มีรอกขนของ",
  },
  {
    id: 2, name: "ทีม B - ปริมณฑล",
    region: "metro", color: "#0ea5e9",
    driverIds: [2],
    helpers: ["คุณนพ ผู้ช่วย"],
    vehicle: "10 ล้อ",
    slotCapacity: 2,
    capacityPerDay: 6,
    branchId: 1,
    active: true,
    notes: "เน้นออเดอร์ใหญ่ · นนท์/สมุทรปราการ/ปทุม",
  },
  {
    id: 3, name: "ทีม C - ต่างจังหวัด",
    region: "upcountry", color: "#10b981",
    driverIds: [3, 5],
    helpers: [],
    vehicle: "10 ล้อ + รถพ่วง",
    slotCapacity: 2,
    capacityPerDay: 6,
    branchId: 1,
    active: true,
    notes: "เน้นทริปยาว · แวะหลายจุด",
  },
];

// Permission check for customer-related actions
function getCustomerById(id) {
  return AppData.customers.find(c => c.id === id);
}

// Get colors for a sofa product based on material type
function getSofaColors(materialType) {
  return AppData.sofaColors[materialType] || [];
}

// ===== ITEM CODE SYSTEM =====
// Format: {categoryCode}-{itemNumber} → e.g., SF-001, BD-002
function generateItemCode(categoryId) {
  const cat = AppData.categories.find(c => c.id === categoryId);
  if (!cat) return null;
  const prefix = cat.code || categoryId.toUpperCase().slice(0, 2);

  // Find max itemNumber in this category
  const items = AppData.products.filter(p => p.categoryId === categoryId);
  const maxNum = items.reduce((m, p) => {
    const n = parseInt((p.itemCode || "").replace(prefix + "-", ""));
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  const nextNum = String(maxNum + 1).padStart(3, "0");
  return `${prefix}-${nextNum}`;
}

// Auto-assign itemCode to existing products on init (one-time)
function ensureItemCodes() {
  const counters = {}; // {categoryId: nextNumber}
  AppData.categories.forEach(c => counters[c.id] = 1);

  AppData.products.forEach(p => {
    if (!p.itemCode) {
      const cat = AppData.categories.find(c => c.id === p.categoryId);
      if (cat) {
        const prefix = cat.code || p.categoryId.toUpperCase().slice(0, 2);
        p.itemCode = `${prefix}-${String(counters[p.categoryId]).padStart(3, "0")}`;
        counters[p.categoryId]++;
      }
    }
  });
}

// ===== DELIVERY SLOT CAPACITY =====
// Returns slot usage for a given date: { morning: {used, capacity}, afternoon: ..., evening: ..., total: ... }
function getSlotUsageForDate(date) {
  const slots = ["morning", "afternoon", "evening"];
  const result = {
    morning: { used: 0, capacity: 0, byTeam: {} },
    afternoon: { used: 0, capacity: 0, byTeam: {} },
    evening: { used: 0, capacity: 0, byTeam: {} },
    anytime: { used: 0 },
    total: 0,
    totalCapacity: 0,
  };

  // Compute total slot capacity (in-house teams only)
  AppData.deliveryTeams.filter(t => t.active).forEach(t => {
    slots.forEach(s => {
      result[s].capacity += (t.slotCapacity || 2);
      result[s].byTeam[t.id] = { used: 0, capacity: t.slotCapacity || 2 };
    });
    result.totalCapacity += (t.slotCapacity || 2) * 3;
  });

  // Count usage from receipts (in-house only count toward team slots)
  AppData.receipts.forEach(r => {
    if (!r.delivery || r.delivery.date !== date || r.status !== "active") return;
    const isInhouse = r.delivery.channelId === "inhouse" || !r.delivery.channelId;
    const ts = r.delivery.timeSlot || "anytime";
    if (isInhouse && r.delivery.teamId && result[ts]) {
      if (slots.includes(ts)) {
        result[ts].used++;
        if (result[ts].byTeam[r.delivery.teamId]) result[ts].byTeam[r.delivery.teamId].used++;
      } else {
        result.anytime.used++;
      }
    }
    result.total++;
  });

  return result;
}

// Find next available slot for a team (auto-allocate "anytime")
function findAvailableSlot(date, teamId) {
  const usage = getSlotUsageForDate(date);
  const slots = ["morning", "afternoon", "evening"];
  // Pick least-loaded slot for this team
  let best = null;
  for (const s of slots) {
    const tu = usage[s].byTeam[teamId];
    if (!tu) continue;
    if (tu.used < tu.capacity) {
      if (!best || tu.used < usage[best].byTeam[teamId].used) best = s;
    }
  }
  return best;
}

// Get products grouped by category
function getProductsByCategory() {
  const grouped = {};
  AppData.categories.forEach(c => grouped[c.id] = { category: c, items: [] });
  AppData.products.forEach(p => {
    if (grouped[p.categoryId]) grouped[p.categoryId].items.push(p);
  });
  // Sort each category's items by itemCode
  Object.values(grouped).forEach(g => {
    g.items.sort((a, b) => (a.itemCode || "").localeCompare(b.itemCode || ""));
  });
  return grouped;
}

// Auto-run on script load
ensureItemCodes();

// Detect if size needs L/R orientation (L-shape or U-shape)
function sizeNeedsOrientation(size) {
  if (!size) return false;
  const txt = `${size.code || ""} ${size.label || ""}`.toLowerCase();
  return txt.includes("l-shape") || txt.includes("l shape") || txt.includes("-l") ||
         txt.includes("u-shape") || txt.includes("u shape") || txt.includes("-u") ||
         size.requiresOrientation === true;
}

// Auto-generate next color code for material type
function nextColorCode(materialType) {
  const list = AppData.sofaColors[materialType] || [];
  const prefix = materialType === "fabric" ? "F" : "L";
  const maxNum = list.reduce((m, c) => {
    const n = parseInt((c.code || "").replace(prefix, ""));
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return prefix + String(maxNum + 1).padStart(2, "0");
}

// ===== ROLES & PERMISSIONS =====
AppData.roles = {
  owner: {
    name: "เจ้าของกิจการ",
    color: "#7c3aed",
    permissions: ["*"], // all
  },
  admin: {
    name: "ผู้จัดการใหญ่",
    color: "#0ea5e9",
    permissions: ["dashboard.view", "pos.use", "stock.view", "stock.edit", "stock.transfer", "products.view", "products.edit", "reports.view", "reports.edit", "settings.view", "settings.branches", "settings.categories", "audit.view", "discount.apply", "discount.unlimited", "customers.view", "customers.edit", "customers.delete", "sales.refund", "delivery.view", "delivery.update", "delivery.dispatch", "delivery.custom_price", "delivery.manage_zones", "sofa.add_color", "data.export", "data.import"],
  },
  manager: {
    name: "ผู้จัดการสาขา",
    color: "#10b981",
    permissions: ["dashboard.view", "pos.use", "stock.view", "stock.edit", "stock.transfer", "products.view", "reports.view", "discount.apply", "customers.view", "customers.edit", "sales.refund", "delivery.view", "delivery.update", "delivery.dispatch", "delivery.custom_price", "delivery.manage_zones", "settings.view", "sofa.add_color", "data.export"],
    discountMaxPercent: 40,
    scopedToBranch: true,
  },
  cashier: {
    name: "แคชเชียร์",
    color: "#f59e0b",
    permissions: ["pos.use", "stock.view", "products.view", "discount.apply", "customers.view", "customers.edit", "delivery.view"],
    discountMaxPercent: 30,
    scopedToBranch: true,
  },
  accountant: {
    name: "ฝ่ายบัญชี",
    color: "#64748b",
    permissions: ["dashboard.view", "reports.view", "reports.edit", "stock.view"],
  },
};

AppData.users = [
  { id: 1, username: "owner", password: "1234", name: "คุณสมชาย ใจดี", role: "owner", branchId: null, email: "owner@furniture.co.th", phone: "081-234-5678", active: true },
  { id: 2, username: "admin", password: "1234", name: "คุณมาลี วงศ์ใหญ่", role: "admin", branchId: null, email: "admin@furniture.co.th", phone: "081-234-5679", active: true },
  { id: 3, username: "siam_mgr", password: "1234", name: "คุณวิชัย สายลม", role: "manager", branchId: 1, email: "siam@furniture.co.th", phone: "081-111-1111", active: true },
  { id: 4, username: "asok_mgr", password: "1234", name: "คุณนภา ขจรกิตติ", role: "manager", branchId: 2, email: "asok@furniture.co.th", phone: "081-222-2222", active: true },
  { id: 5, username: "cashier1", password: "1234", name: "คุณสมหมาย เก่งกาจ", role: "cashier", branchId: 1, email: "cashier1@furniture.co.th", phone: "081-333-3333", active: true },
  { id: 6, username: "cashier2", password: "1234", name: "คุณปิยะ น่ารัก", role: "cashier", branchId: 3, email: "cashier2@furniture.co.th", phone: "081-444-4444", active: true },
  { id: 7, username: "account", password: "1234", name: "คุณสุภา ละเอียด", role: "accountant", branchId: null, email: "finance@furniture.co.th", phone: "081-555-5555", active: true },
];

// Hash all default plaintext passwords on load (one-time)
AppData.users.forEach(u => {
  if (!u.password.startsWith("fh$")) {
    u.password = hashPassword(u.password);
  }
});

// Discount limit per role
function getMaxDiscountPercent() {
  if (!State?.currentUser) return 0;
  const role = AppData.roles[State.currentUser.role];
  if (!role) return 0;
  if (role.permissions.includes("*") || role.permissions.includes("discount.unlimited")) return 100;
  if (role.permissions.includes("discount.apply")) return role.discountMaxPercent ?? 0;
  return 0;
}

// Permission helper
function hasPermission(perm) {
  if (!State.currentUser) return false;
  const role = AppData.roles[State.currentUser.role];
  if (!role) return false;
  if (role.permissions.includes("*")) return true;
  return role.permissions.includes(perm);
}

function isBranchScoped() {
  if (!State.currentUser) return true;
  return AppData.roles[State.currentUser.role]?.scopedToBranch || false;
}

function canAccessBranch(branchId) {
  if (!State.currentUser) return false;
  if (!isBranchScoped()) return true;
  return State.currentUser.branchId === branchId;
}

// ===== CART & STATE =====
const State = {
  currentUser: null,
  language: "th",
  currentBranch: 1,
  currentPage: "dashboard",
  discount: { type: "percent", value: 0, reason: "" },
  selectedCustomer: null,
  redeemPoints: 0,
  deposit: { enabled: false, type: "percent", value: 30 },  // type: percent | amount | full
  deliveryView: "list",  // list | month | week | day
  deliveryAnchorDate: new Date().toISOString().split("T")[0], // current focus date for calendar
  delivery: {
    zoneId: "pickup",
    channelId: "inhouse",
    teamId: null,
    address: "",
    recipientName: "",
    recipientPhone: "",
    date: "",
    timeSlot: "anytime",
    note: "",
    customFee: 0,
    customReason: "",
  },
  cart: [],
  selectedProduct: null,
  selectedSize: null,
  selectedColor: null,
  selectedMaterialType: "fabric",
  selectedOrientation: "left",
  selectedImageIdx: 0,
  stockViewBranch: 1,
  stockCategoryFilter: "all",
  receipts: [],
  receiptCounter: 1001,
  productTab: "detail",
  reportTab: "settings",
};

function getCurrentBranch() {
  return AppData.branches.find(b => b.id === State.currentBranch);
}

// Sales branches (excludes warehouses)
function getSalesBranches() {
  return AppData.branches.filter(b => !b.isWarehouse);
}

// All locations (includes warehouse)
function getAllLocations() {
  return AppData.branches;
}

function getProductStock(product) {
  return product.stock[State.currentBranch] || 0;
}

function formatCurrency(amount) {
  return amount.toLocaleString("th-TH", { minimumFractionDigits: 0 });
}

function getTodayTotal() {
  return Object.values(AppData.todaySales).reduce((s, v) => s + v.amount, 0);
}

function getLowStockProducts(branchId = null) {
  if (branchId) {
    return AppData.products.filter(p => (p.stock[branchId] || 0) <= p.minStock);
  }
  // Global view: any branch with stock at/below minStock
  return AppData.products.filter(p =>
    AppData.branches.some(b => (p.stock[b.id] || 0) <= p.minStock)
  );
}

function getOutOfStockProducts(branchId) {
  return AppData.products.filter(p => (p.stock[branchId] || 0) === 0);
}
