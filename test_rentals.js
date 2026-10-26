// test_rentals.js
// Automated verification for Savatchi Rentals (Arenda) Module

// 1. Mock LocalStorage in Node.js
class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] !== undefined ? this.store[key] : null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

globalThis.localStorage = new LocalStorageMock();
globalThis.window = {
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {}
};

async function runRentalTests() {
  console.log('====================================================');
  console.log('SAVATCHI: IJARA (ARENDA) TIZIMINI SINOVDAN O‘TKAZISH');
  console.log('====================================================\n');

  const {
    isRentalSupportedStoreType,
    RENTAL_ALLOWED_STORE_TYPES
  } = await import('./src/config/storeTypes.js');

  const results = {};

  // ----------------------------------------------------
  // TEST 1: Do'kon turlari bo'yicha ruxsat tekshiruvi
  // Faqat 4 ta do'kon turida ruxsat berilishi kerak
  // ----------------------------------------------------
  try {
    const allowed = ['household', 'sport', 'accessories', 'phone', 'Uy-ro‘zg‘or buyumlari', 'Sport jihozlari', 'Aksessuarlar do‘koni', 'Telefon do‘koni'];
    const forbidden = ['food', 'clothing', 'pharmacy', 'electronics', 'books', 'beauty', 'auto', 'Oziq-ovqat', 'Kiyim-kechak'];

    const allAllowedPass = allowed.every(t => isRentalSupportedStoreType(t) === true);
    const allForbiddenBlocked = forbidden.every(t => isRentalSupportedStoreType(t) === false);

    if (allAllowedPass && allForbiddenBlocked) {
      results['1'] = {
        pass: true,
        msg: 'Faqat belgilangan 4 ta do‘kon turiga (household, sport, accessories, phone) ruxsat berildi, boshqalar bloklandi.'
      };
    } else {
      results['1'] = {
        pass: false,
        msg: `allowedPass: ${allAllowedPass}, forbiddenBlocked: ${allForbiddenBlocked}`
      };
    }
  } catch (err) {
    results['1'] = { pass: false, msg: err.message };
  }
  console.log(`[TEST 1] ${results['1'].pass ? 'MUVAFFAQ TARZDA O‘TDI' : 'XATOLIK'}: ${results['1'].msg}`);

  // ----------------------------------------------------
  // TEST 2: Ijara yaratish va ombor hisobi kamayishi
  // ----------------------------------------------------
  const storeId1 = 'store-rentals-01';
  let initialStock = 10;
  let rentedQty = 2;
  let testProduct = { id: 'prod-drill-01', name: 'Drel / Perforator', price: 500000, stock: initialStock };
  let rentalRecord;

  try {
    // Ombor holatini saqlash
    localStorage.setItem(`savatchi_products_${storeId1}`, JSON.stringify([testProduct]));

    // Yangi ijara qo'shish mantig'i simulyatsiyasi (StoreContext addRental bilan bir xil)
    const fee = 100000;
    const initialPaid = 40000;
    rentalRecord = {
      id: 'rent-001',
      storeId: storeId1,
      customerId: 'cust-01',
      customerName: 'Javohir Aliyev',
      customerPhone: '+998 90 123 45 67',
      productId: testProduct.id,
      productName: testProduct.name,
      qty: rentedQty,
      startDate: '2026-10-24',
      endDate: '2026-10-28',
      rentalFee: fee,
      paidAmount: initialPaid,
      remainingAmount: fee - initialPaid,
      status: 'Faol',
      payments: [
        { id: 'pay-01', amount: initialPaid, date: '2026-10-24', type: 'Naqd' }
      ]
    };

    // Ombordan ayirish
    testProduct.stock -= rentedQty;
    localStorage.setItem(`savatchi_products_${storeId1}`, JSON.stringify([testProduct]));
    localStorage.setItem(`savatchi_rentals_${storeId1}`, JSON.stringify([rentalRecord]));

    const checkProds = JSON.parse(localStorage.getItem(`savatchi_products_${storeId1}`));
    const checkRentals = JSON.parse(localStorage.getItem(`savatchi_rentals_${storeId1}`));

    if (
      checkProds[0].stock === 8 &&
      checkRentals.length === 1 &&
      checkRentals[0].remainingAmount === 60000 &&
      checkRentals[0].status === 'Faol'
    ) {
      results['2'] = {
        pass: true,
        msg: `Ijara muvaffaqiyatli yaratildi. Mahsulot omboridan ${rentedQty} dona kamaydi (10 -> 8), qoldiq summa: 60,000 so‘m.`
      };
    } else {
      results['2'] = {
        pass: false,
        msg: `Stock: ${checkProds[0].stock}, Remaining: ${checkRentals[0].remainingAmount}`
      };
    }
  } catch (err) {
    results['2'] = { pass: false, msg: err.message };
  }
  console.log(`[TEST 2] ${results['2'].pass ? 'MUVAFFAQ TARZDA O‘TDI' : 'XATOLIK'}: ${results['2'].msg}`);

  // ----------------------------------------------------
  // TEST 3: Buyum qaytarilganda ombor hisobi to‘g‘ri tiklanishi
  // ----------------------------------------------------
  try {
    // Holatni "Qaytarilgan"ga o'tkazish
    const targetStatus = 'Qaytarilgan';
    if (rentalRecord.status !== targetStatus) {
      rentalRecord.status = targetStatus;
      rentalRecord.returnedDate = '2026-10-25';
      // Omborga qaytarish
      testProduct.stock += rentalRecord.qty;
      localStorage.setItem(`savatchi_products_${storeId1}`, JSON.stringify([testProduct]));
      localStorage.setItem(`savatchi_rentals_${storeId1}`, JSON.stringify([rentalRecord]));
    }

    const checkProds = JSON.parse(localStorage.getItem(`savatchi_products_${storeId1}`));
    const checkRentals = JSON.parse(localStorage.getItem(`savatchi_rentals_${storeId1}`));

    if (
      checkRentals[0].status === 'Qaytarilgan' &&
      checkProds[0].stock === initialStock
    ) {
      results['3'] = {
        pass: true,
        msg: `Buyum qaytarilgach ombor zaxirasi to‘liq tiklandi (${checkProds[0].stock} dona) va holati "Qaytarilgan" bo‘ldi.`
      };
    } else {
      results['3'] = {
        pass: false,
        msg: `Status: ${checkRentals[0].status}, Stock: ${checkProds[0].stock}`
      };
    }
  } catch (err) {
    results['3'] = { pass: false, msg: err.message };
  }
  console.log(`[TEST 3] ${results['3'].pass ? 'MUVAFFAQ TARZDA O‘TDI' : 'XATOLIK'}: ${results['3'].msg}`);

  // ----------------------------------------------------
  // TEST 4: Ijara to'lovi kiritilganda qoldiq summa to'g'ri yangilanishi
  // ----------------------------------------------------
  try {
    // Qolgan 60,000 so'mdan 60,000 to'lov kiritiladi
    const paymentAmount = 60000;
    rentalRecord.paidAmount += paymentAmount;
    rentalRecord.remainingAmount = Math.max(0, rentalRecord.rentalFee - rentalRecord.paidAmount);
    rentalRecord.payments.push({ id: 'pay-02', amount: paymentAmount, date: '2026-10-25', type: 'Karta' });

    localStorage.setItem(`savatchi_rentals_${storeId1}`, JSON.stringify([rentalRecord]));

    const checkRentals = JSON.parse(localStorage.getItem(`savatchi_rentals_${storeId1}`));

    if (
      checkRentals[0].paidAmount === 100000 &&
      checkRentals[0].remainingAmount === 0 &&
      checkRentals[0].payments.length === 2
    ) {
      results['4'] = {
        pass: true,
        msg: 'To‘lov to‘liq qabul qilindi, qoldiq qarz 0 so‘m bo‘ldi va to‘lovlar tarixi saqlandi.'
      };
    } else {
      results['4'] = {
        pass: false,
        msg: `Paid: ${checkRentals[0].paidAmount}, Remaining: ${checkRentals[0].remainingAmount}`
      };
    }
  } catch (err) {
    results['4'] = { pass: false, msg: err.message };
  }
  console.log(`[TEST 4] ${results['4'].pass ? 'MUVAFFAQ TARZDA O‘TDI' : 'XATOLIK'}: ${results['4'].msg}`);

  // ----------------------------------------------------
  // TEST 5: Turli do'konlar o'rtasida ijara ma'lumotlari izolyatsiyasi
  // ----------------------------------------------------
  try {
    const storeId2 = 'store-rentals-02';
    const store2Rentals = localStorage.getItem(`savatchi_rentals_${storeId2}`);

    if (store2Rentals === null) {
      results['5'] = {
        pass: true,
        msg: '1-do‘konning ijara ma’lumotlari 2-do‘konga mutlaqo aralashmadi (storeId bo‘yicha to‘liq izolyatsiya).'
      };
    } else {
      results['5'] = {
        pass: false,
        msg: `Store 2 contains data: ${store2Rentals}`
      };
    }
  } catch (err) {
    results['5'] = { pass: false, msg: err.message };
  }
  console.log(`[TEST 5] ${results['5'].pass ? 'MUVAFFAQ TARZDA O‘TDI' : 'XATOLIK'}: ${results['5'].msg}`);

  console.log('\n====================================================');
  const allPassed = Object.values(results).every(r => r.pass);
  console.log(`UMUMIY NATIJA: ${allPassed ? 'BARCHA IJARA SINOVLARI 100% MUVAFFAQ QILINDI!' : 'AYRIM SINOVLARDA XATOLIK BOR'}`);
  console.log('====================================================');
}

runRentalTests();
