/**
 * Demo knowledge for a fictional UK estate agency — listings with mock photos (Unsplash source via picsum).
 * Run: npx prisma db seed   (requires DATABASE_URL / DIRECT_URL)
 * Re-run safe: removes prior rows whose titles start with "[Demo UK Estate]".
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PREFIX = "[Demo UK Estate]";

const documents = [
  {
    title: `${PREFIX} Company overview`,
    content: `Thames & Keystone Residential Ltd (fictional demo data — not a real firm)

Who we are
Independent estate agency covering sales, lettings, and new homes across Greater Manchester and Cheshire. RICS-style processes; all figures are illustrative for demos only.

Registered office (fictional)
Unit 4, Riverside Exchange, 88 Deansgate, Manchester M3 2BW

General enquiries (demo)
Phone: 0161 555 0142
Email: enquiries@thames-keystone-demo.example
Hours: Monday–Friday 9:00–18:00, Saturday 10:00–16:00 (by appointment Sundays)

What we help with
- Free market appraisals for sellers
- Buyer registration and accompanied viewings
- Landlord onboarding and compliance checks (demo narrative)
- Referrals to independent mortgage brokers and conveyancing solicitors (we do not provide legal or financial advice)`,
  },
  {
    title: `${PREFIX} Buying a property (UK)`,
    content: `Buying with Thames & Keystone (fictional demo)

Typical journey
1. Register your requirements (budget, areas, must-haves). We send matching listings.
2. Viewings: accompanied where requested; evening slots by arrangement.
3. Offer: submitted in writing. We track chain position at a high level only.
4. Mortgage in principle: we can introduce FCA-authorised brokers.
5. Conveyancing: use your own solicitor or ask for panel introductions.

Costs buyers should plan for (illustrative only)
Stamp Duty, searches, surveys — your solicitor and HMRC guidance apply.

Areas we often work (demo)
Didsbury, Chorlton, Sale, Altrincham, Wilmslow, Stockport SK postcodes, central Manchester apartments.`,
  },
  {
    title: `${PREFIX} Selling your home`,
    content: `Selling with Thames & Keystone (fictional demo)

Marketing package (typical)
- Professional photography and floorplan
- Rightmove, Zoopla, OnTheMarket syndication where contract allows
- Accompanied viewings and feedback within 24 hours

Pricing strategy
Comparable evidence from sold prices; no guaranteed sale price.

EPC
Valid Energy Performance Certificate required before marketing.

Offers
All offers recorded in writing. We verify buyer position at a high level.`,
  },
  {
    title: `${PREFIX} Lettings & landlords`,
    content: `Lettings (fictional demo — not legal advice)

Services: tenant find, fully managed, selected HMO/student blocks.

Compliance (general)
Right to Rent, deposit protection, gas safety, licensing — confirm with your local authority.

Fees: agreed in the management agreement; the AI must not invent percentages.`,
  },
  {
    title: `${PREFIX} Viewings & offers — FAQs`,
    content: `Frequently asked questions (fictional demo)

How do I book a viewing? Share preferred times; we confirm with the vendor.

Can I make a video viewing first? Available where the owner agrees.

International buyers: AML checks apply.`,
  },
  {
    title: `${PREFIX} LISTING — The Cotton Works, 2-bed duplex, Northern Quarter`,
    content: `Fictional demo listing — NOT a real property.

Address (demo): The Cotton Works, 14 Bengal Street, Manchester M4 6LN
Asking price: £339,950 (guide)
Tenure: Leasehold — remainder 987 years (demo). Ground rent £250 pa peppercorn-style (verify). Service charge budget circa £2,640 pa including buildings insurance block (illustrative).

The property
Fourth-floor duplex: open-plan living/kitchen, two double bedrooms (principal with ensuite shower), family bathroom, balcony facing courtyard. Approx 887 sq ft / 82 m² (demo measurements).

Features
Induction hob, integrated fridge-freezer and dishwasher, walnut laminate in living areas, carpet in bedrooms. Secure entry, lift access, one allocated underground parking space (demo).

EPC rating B (demo certificate ref TK-DEMO-EPC-88421).
Council Tax Band D — Manchester City Council (buyer to confirm).

Viewings: weekday evenings and Saturday mornings by appointment.
Seller motivated — chain-free buyer preferred.`,
    imagePaths: [
      "https://picsum.photos/seed/cottonworksfront/1200/800",
      "https://picsum.photos/seed/cottonworksliving/1200/800",
    ],
  },
  {
    title: `${PREFIX} LISTING — Elm Grove, 3-bed semi, Sale M33`,
    content: `Fictional demo listing — NOT a real property.

Address (demo): 42 Elm Grove, Sale M33 4JY
Offers in excess of £424,950
Tenure: Freehold

The property
1930s semi-detached with side driveway and detached brick garage (demo). Hall, lounge with bay window, separate dining room opening to fitted kitchen with quartz-style worktops. Three bedrooms (two doubles, one single/home office). Family bathroom with shower over bath. Rear garden approx 52 ft west-facing lawn with paved patio.

Approx 1,076 sq ft / 100 m² over two floors.

EPC rating C. Council Tax Band E (Trafford — illustrative).

School catchment: popular primaries nearby — buyers must verify admissions rules.

No onward chain (demo scenario).`,
    imagePaths: [
      "https://picsum.photos/seed/elmgroveext/1200/800",
      "https://picsum.photos/seed/elmgrovekit/1200/800",
    ],
  },
  {
    title: `${PREFIX} LISTING — Victorian terrace, 4-bed, Chorlton`,
    content: `Fictional demo listing — NOT a real property.

Address (demo): 188 Oswald Road, Chorlton-cum-Hardy M21 9GW
Guide price £549,000
Tenure: Freehold

The property
Mid-terrace Victorian with cellar converted to home office/gym (demo). Two receptions, extended eat-in kitchen with bi-fold doors to garden. Four bedrooms (three doubles, one single). Bathroom plus separate WC on first floor.

Approx 1,312 sq ft inc cellar studio.

EPC rating D (demo). Council Tax Band F.

Parking: on-street resident permit zone CH47 (verify with council).

Ideal for families needing workspace and good transport links to city centre.`,
    imagePaths: [
      "https://picsum.photos/seed/oswaldvic/1200/800",
      "https://picsum.photos/seed/oswaldgdn/1200/800",
    ],
  },
  {
    title: `${PREFIX} LISTING — Riverside 1-bed, Salford Quays`,
    content: `Fictional demo listing — NOT a real property.

Address (demo): Apartment 806, Merchants Quay, Salford M50 3XZ
Asking price £189,950
Tenure: Leasehold — 108 years remaining (demo). Service charge approx £3,200 pa including concierge & gym (illustrative).

The property
One double bedroom, open-plan kitchen/lounge with floor-to-ceiling glazing and Juliet balcony with river views (demo). Secure parking space included.

Approx 538 sq ft.

Tenant in situ until [demo date] at £950 pcm — investor yield circa 6% gross before costs (illustrative only).

EPC rating B. Council Tax Band C.`,
    imagePaths: [
      "https://picsum.photos/seed/merchants806/1200/800",
      "https://picsum.photos/seed/merchantsview/1200/800",
    ],
  },
  {
    title: `${PREFIX} LISTING — New-build 3-bed, Wilmslow SK9`,
    content: `Fictional demo listing — NOT a real property.

Address (demo): Plot 12, Alderley Fields, Manchester Road, Wilmslow SK9 2PE
From £685,000 (Help-to-buy-style schemes may apply — speak to a broker; demo only)

The property
Detached three-storey home: hallway, lounge, WC, open-plan kitchen/diner with utility. Four beds on paper — marketed as 3 generous beds plus dressing/study (demo layout). Two bathrooms (one ensuite). Integral garage and two driveway spaces.

Plot approx 1,428 sq ft.

NHBC warranty (demo). EPC target A (off-plan).

Show home open Thursday–Sunday 11:00–17:00 by appointment.`,
    imagePaths: [
      "https://picsum.photos/seed/alderleyplot12/1200/800",
      "https://picsum.photos/seed/alderleyhall/1200/800",
    ],
  },
];

async function main() {
  const deleted = await prisma.knowledgeDocument.deleteMany({
    where: { title: { startsWith: PREFIX } },
  });
  console.log(`Removed ${deleted.count} previous demo knowledge row(s).`);

  const result = await prisma.knowledgeDocument.createMany({
    data: documents.map((d) => ({
      title: d.title,
      content: d.content,
      sourceType: "text",
      ...(d.imagePaths ? { imagePaths: d.imagePaths } : {}),
    })),
  });
  console.log(`Inserted ${result.count} knowledge document(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
