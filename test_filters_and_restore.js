// test_filters_and_restore.js
import assert from 'assert';
import {
  computeContractStatus,
  getTashkentDateString,
  applyPaymentToContract,
  generateInstallmentSchedule
} from './src/utils/installmentUtils.js';

console.log("=================================================");
console.log("SAVATCHI — FILTRLAR VA QAYTA TIKLASH TESTLARI");
console.log("=================================================\n");

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(err);
  }
}

const todayStr = '2026-10-25';

// Mock contract templates
const createSampleContracts = () => [
  {
    id: 'c-active',
    contractNumber: 'MT-001',
    customerName: 'Ali Valiev',
    remainingAmount: 500000,
    totalAmount: 1000000,
    totalPaid: 500000,
    status: 'active',
    schedule: [
      { id: 's1', dueDate: '2026-11-25', amount: 500000, paidAmount: 0, isPaid: false }
    ],
    items: [{ productId: 'p1', name: 'Telefon', qty: 1 }]
  },
  {
    id: 'c-due',
    contractNumber: 'MT-002',
    customerName: 'Hasan Umarov',
    remainingAmount: 400000,
    totalAmount: 800000,
    totalPaid: 400000,
    status: 'active',
    schedule: [
      { id: 's2', dueDate: '2026-10-25', amount: 400000, paidAmount: 0, isPaid: false }
    ],
    items: [{ productId: 'p2', name: 'Dazmol', qty: 2 }]
  },
  {
    id: 'c-overdue',
    contractNumber: 'MT-003',
    customerName: 'Olim Hakimov',
    remainingAmount: 600000,
    totalAmount: 1200000,
    totalPaid: 600000,
    status: 'active',
    schedule: [
      { id: 's3', dueDate: '2026-10-10', amount: 600000, paidAmount: 0, isPaid: false }
    ],
    items: [{ productId: 'p1', name: 'Telefon', qty: 1 }]
  },
  {
    id: 'c-completed',
    contractNumber: 'MT-004',
    customerName: 'Zarif Karimov',
    remainingAmount: 0,
    totalAmount: 1500000,
    totalPaid: 1500000,
    status: 'completed',
    schedule: [
      { id: 's4', dueDate: '2026-10-01', amount: 1500000, paidAmount: 1500000, isPaid: true }
    ],
    items: [{ productId: 'p3', name: 'Changyutgich', qty: 1 }]
  },
  {
    id: 'c-cancelled-returned',
    contractNumber: 'MT-005',
    customerName: 'Bekorchi 1 (Qaytarilgan)',
    remainingAmount: 900000,
    totalAmount: 1000000,
    totalPaid: 100000,
    status: 'cancelled',
    returnedToStock: true,
    cancelReason: 'Mijoz to‘lay olmadi',
    schedule: [
      { id: 's5', dueDate: '2026-11-20', amount: 900000, paidAmount: 0, isPaid: false }
    ],
    items: [{ productId: 'p1', name: 'Telefon', qty: 2 }]
  },
  {
    id: 'c-cancelled-not-returned',
    contractNumber: 'MT-006',
    customerName: 'Bekorchi 2 (Qaytarilmagan)',
    remainingAmount: 500000,
    totalAmount: 700000,
    totalPaid: 200000,
    status: 'cancelled',
    returnedToStock: false,
    cancelReason: 'Boshqa sabab',
    schedule: [
      { id: 's6', dueDate: '2026-11-20', amount: 500000, paidAmount: 0, isPaid: false }
    ],
    items: [{ productId: 'p2', name: 'Dazmol', qty: 1 }]
  }
];

// ─── TEST 1: 6 TA FILTR TUGMALARI VA ULARNING ISHLASHI ─────────────────────────
runTest("1. Oltita filtrning har biri to'g'ri natija ko'rsatishi", () => {
  const contracts = createSampleContracts();
  const getStatus = (c) => computeContractStatus(c, todayStr);

  const filterFn = (activeTab) => contracts.filter((c) => {
    const status = getStatus(c);
    if (activeTab === 'active' && (status === 'cancelled' || status === 'completed')) return false;
    if (activeTab === 'due' && status !== 'due') return false;
    if (activeTab === 'overdue' && status !== 'overdue') return false;
    if (activeTab === 'completed' && status !== 'completed') return false;
    if (activeTab === 'cancelled' && status !== 'cancelled') return false;
    return true;
  });

  // Tab counts
  let allCount = contracts.length;
  let activeCount = 0, dueCount = 0, overdueCount = 0, completedCount = 0, cancelledCount = 0;
  contracts.forEach(c => {
    const s = getStatus(c);
    if (s === 'cancelled') cancelledCount++;
    else if (s === 'completed') completedCount++;
    else {
      activeCount++;
      if (s === 'due') dueCount++;
      if (s === 'overdue') overdueCount++;
    }
  });

  // 1. Barchasi: 6 ta
  const allList = filterFn('all');
  assert.strictEqual(allList.length, 6, "Barchasi barcha 6 ta shartnomani ko'rsatishi kerak");
  assert.strictEqual(allCount, 6);

  // 2. Faol: 3 ta (active, due, overdue - bekor qilinmagan va tugallanmagan)
  const activeList = filterFn('active');
  assert.strictEqual(activeList.length, 3, "Faol filtrida 3 ta amaldagi shartnoma bo'lishi kerak");
  assert.strictEqual(activeCount, 3);
  assert.strictEqual(activeList.some(c => c.id === 'c-cancelled-returned'), false);
  assert.strictEqual(activeList.some(c => c.id === 'c-completed'), false);

  // 3. Bugungi to'lov: 1 ta (c-due)
  const dueList = filterFn('due');
  assert.strictEqual(dueList.length, 1, "Bugungi to'lov faqat 1 ta shartnomani ko'rsatishi kerak");
  assert.strictEqual(dueList[0].id, 'c-due');
  assert.strictEqual(dueCount, 1);

  // 4. Muddati o'tgan: 1 ta (c-overdue)
  const overdueList = filterFn('overdue');
  assert.strictEqual(overdueList.length, 1, "Muddati o'tgan faqat 1 ta shartnomani ko'rsatishi kerak");
  assert.strictEqual(overdueList[0].id, 'c-overdue');
  assert.strictEqual(overdueCount, 1);

  // 5. To'liq to'langan: 1 ta (c-completed)
  const completedList = filterFn('completed');
  assert.strictEqual(completedList.length, 1, "To'liq to'langan faqat 1 ta shartnomani ko'rsatishi kerak");
  assert.strictEqual(completedList[0].id, 'c-completed');
  assert.strictEqual(completedCount, 1);

  // 6. Bekor qilingan: 2 ta (c-cancelled-returned, c-cancelled-not-returned)
  const cancelledList = filterFn('cancelled');
  assert.strictEqual(cancelledList.length, 2, "Bekor qilingan 2 ta shartnomani ko'rsatishi kerak");
  assert.strictEqual(cancelledCount, 2);
});

// ─── TEST 2: QAYTA TIKLASH — OMBORGA QAYTARILGAN HOLAT ────────────────────────
runTest("2. Mahsulot omborga qaytarilgan shartnoma tiklanganda faqat shartnomadagi miqdor ombordan ayrilishi", () => {
  let products = [
    { id: 'p1', name: 'Telefon', stock: 10 },
    { id: 'p2', name: 'Dazmol', stock: 5 }
  ];
  let installments = createSampleContracts();

  const adjustStock = (id, delta) => {
    products = products.map(p => p.id === id ? { ...p, stock: p.stock + delta } : p);
  };

  const restoreContract = (contractId) => {
    const contract = installments.find(c => c.id === contractId);
    if (!contract) throw new Error("Topilmadi");
    if (contract.status !== 'cancelled') throw new Error("Bekor qilinmagan");

    const wasReturned = !!contract.returnedToStock;
    if (wasReturned && Array.isArray(contract.items)) {
      for (const item of contract.items) {
        const prod = products.find(p => p.id === item.productId);
        const reqQty = Number(item.qty) || 1;
        if (!prod || prod.stock < reqQty) {
          throw new Error("Omborda mahsulot yetarli emas");
        }
      }
      for (const item of contract.items) {
        adjustStock(item.productId, -Number(item.qty));
      }
    }

    const baseContract = { ...contract, status: 'active', returnedToStock: false };
    const restored = { ...baseContract, status: computeContractStatus(baseContract, todayStr) };
    installments = installments.map(c => c.id === contractId ? restored : c);
    return restored;
  };

  // c-cancelled-returned da Telefon 2 dona
  // Dastlabki ombor: Telefon 10 ta
  const restored = restoreContract('c-cancelled-returned');

  assert.strictEqual(restored.status, 'active', "Shartnoma holati faolga qaytishi kerak");
  assert.strictEqual(restored.returnedToStock, false);
  const p1 = products.find(p => p.id === 'p1');
  assert.strictEqual(p1.stock, 8, "Ombordagi telefonlar soni 10 dan 8 ga tushishi shart (2 dona ayrildi)");
  const p2 = products.find(p => p.id === 'p2');
  assert.strictEqual(p2.stock, 5, "Boshqa mahsulotlar o'zgarmasligi shart");
});

// ─── TEST 3: QAYTA TIKLASH — OMBORGA QAYTARILMAGAN HOLAT ───────────────────────
runTest("3. Mahsulot omborga qaytarilmagan shartnoma tiklanganda ombor qoldig'i o'zgarmasligi", () => {
  let products = [
    { id: 'p1', name: 'Telefon', stock: 8 },
    { id: 'p2', name: 'Dazmol', stock: 5 }
  ];
  let installments = createSampleContracts();

  const adjustStock = (id, delta) => {
    products = products.map(p => p.id === id ? { ...p, stock: p.stock + delta } : p);
  };

  const restoreContract = (contractId) => {
    const contract = installments.find(c => c.id === contractId);
    if (!contract) throw new Error("Topilmadi");
    if (contract.status !== 'cancelled') throw new Error("Bekor qilinmagan");

    const wasReturned = !!contract.returnedToStock;
    if (wasReturned && Array.isArray(contract.items)) {
      for (const item of contract.items) {
        const prod = products.find(p => p.id === item.productId);
        const reqQty = Number(item.qty) || 1;
        if (!prod || prod.stock < reqQty) {
          throw new Error("Omborda mahsulot yetarli emas");
        }
      }
      for (const item of contract.items) {
        adjustStock(item.productId, -Number(item.qty));
      }
    }

    const baseContract = { ...contract, status: 'active', returnedToStock: false };
    const restored = { ...baseContract, status: computeContractStatus(baseContract, todayStr) };
    installments = installments.map(c => c.id === contractId ? restored : c);
    return restored;
  };

  // c-cancelled-not-returned: returnedToStock === false, Dazmol 1 dona
  const restored = restoreContract('c-cancelled-not-returned');

  assert.strictEqual(restored.status, 'active');
  const p2 = products.find(p => p.id === 'p2');
  assert.strictEqual(p2.stock, 5, "Omborga qaytarilmagan bo'lgani sababli ombor qoldig'i o'zgarmasligi shart (5 ta qoladi)");
});

// ─── TEST 4: OMBORDA QOLDIQ YETARLI BO'LMAGANDA XAVFSIZ TO'XTIHI ──────────────
runTest("4. Ombor qoldig'i yetarli bo'lmaganda qayta tiklash xavfsiz to'xtashi", () => {
  let products = [
    { id: 'p1', name: 'Telefon', stock: 1 } // shartnomada 2 ta kerak!
  ];
  let installments = createSampleContracts();

  let stockAdjusted = false;
  const adjustStock = (id, delta) => {
    stockAdjusted = true;
    products = products.map(p => p.id === id ? { ...p, stock: p.stock + delta } : p);
  };

  const restoreContract = (contractId) => {
    const contract = installments.find(c => c.id === contractId);
    if (!contract) throw new Error("Topilmadi");
    if (contract.status !== 'cancelled') throw new Error("Bekor qilinmagan");

    const wasReturned = !!contract.returnedToStock;
    if (wasReturned && Array.isArray(contract.items)) {
      for (const item of contract.items) {
        const prod = products.find(p => p.id === item.productId);
        const reqQty = Number(item.qty) || 1;
        if (!prod || prod.stock < reqQty) {
          throw new Error(`Omborda mahsulot yetarli emas: "${item.name}" mahsulotidan omborda ${prod ? prod.stock : 0} ta qolgan, shartnomani tiklash uchun esa ${reqQty} ta zarur. Qayta tiklash bekor qilindi.`);
        }
      }
      for (const item of contract.items) {
        adjustStock(item.productId, -Number(item.qty));
      }
    }

    const baseContract = { ...contract, status: 'active', returnedToStock: false };
    const restored = { ...baseContract, status: computeContractStatus(baseContract, todayStr) };
    installments = installments.map(c => c.id === contractId ? restored : c);
    return restored;
  };

  assert.throws(() => {
    restoreContract('c-cancelled-returned');
  }, /Omborda mahsulot yetarli emas/, "Xato xabari qaytarilishi shart");

  assert.strictEqual(stockAdjusted, false, "Ombor qoldig'iga mutlaqo tegilmasligi shart");
  assert.strictEqual(products[0].stock, 1, "Telefon qoldig'i 1 taligicha qolishi shart");
  assert.strictEqual(installments.find(c => c.id === 'c-cancelled-returned').status, 'cancelled', "Shartnoma cancelled holatida qolishi shart");
});

// ─── TEST 5: BIR SHARTNOMANI QAYTA TIKLASH IKKI MARTA OMBORNI O'ZGARTIRMASLIGI ─
runTest("5. Bir shartnomani qayta tiklash ikki marta ombor miqdorini o'zgartirmasligi", () => {
  let products = [{ id: 'p1', name: 'Telefon', stock: 10 }];
  let installments = createSampleContracts();

  const adjustStock = (id, delta) => {
    products = products.map(p => p.id === id ? { ...p, stock: p.stock + delta } : p);
  };

  const restoreContract = (contractId) => {
    const contract = installments.find(c => c.id === contractId);
    if (!contract) throw new Error("Topilmadi");
    if (contract.status !== 'cancelled') throw new Error("Faqat bekor qilingan shartnomani qayta tiklash mumkin.");

    const wasReturned = !!contract.returnedToStock;
    if (wasReturned && Array.isArray(contract.items)) {
      for (const item of contract.items) {
        const prod = products.find(p => p.id === item.productId);
        const reqQty = Number(item.qty) || 1;
        if (!prod || prod.stock < reqQty) {
          throw new Error("Omborda mahsulot yetarli emas");
        }
      }
      for (const item of contract.items) {
        adjustStock(item.productId, -Number(item.qty));
      }
    }

    const baseContract = { ...contract, status: 'active', returnedToStock: false };
    const restored = { ...baseContract, status: computeContractStatus(baseContract, todayStr) };
    installments = installments.map(c => c.id === contractId ? restored : c);
    return restored;
  };

  // 1-marta tiklash
  restoreContract('c-cancelled-returned');
  assert.strictEqual(products[0].stock, 8);

  // 2-marta tiklashga urinish
  assert.throws(() => {
    restoreContract('c-cancelled-returned');
  }, /Faqat bekor qilingan shartnomani qayta tiklash mumkin/, "Ikkinchi marta tiklash bloklanishi shart");

  assert.strictEqual(products[0].stock, 8, "Ombor qoldig'i 8 taligicha qolishi shart (takroran ayrilmaydi)");
});

// ─── TEST 6: TO'LANGAN SUMMALAR VA TO'LOV TARIXI SAQLANISHI ───────────────────
runTest("6. To'langan summalar va to'lovlar tarixi saqlanishi", () => {
  const original = {
    id: 'c-cancelled-history',
    contractNumber: 'MT-777',
    customerName: 'Tarix Test',
    totalAmount: 1000000,
    downPayment: 200000,
    totalPaid: 500000,
    remainingAmount: 500000,
    status: 'cancelled',
    returnedToStock: false,
    payments: [
      { id: 'p-1', amount: 200000, date: '2026-08-01', note: 'Boshlang‘ich' },
      { id: 'p-2', amount: 300000, date: '2026-09-01', note: '1-oy to‘lovi' }
    ],
    schedule: [
      { id: 's-1', dueDate: '2026-09-01', amount: 300000, paidAmount: 300000, isPaid: true },
      { id: 's-2', dueDate: '2026-11-01', amount: 500000, paidAmount: 0, isPaid: false }
    ],
    items: [{ productId: 'p1', name: 'Telefon', qty: 1 }]
  };

  // Restoring
  const baseContract = { ...original, status: 'active', returnedToStock: false };
  const restored = { ...baseContract, status: computeContractStatus(baseContract, todayStr) };

  assert.strictEqual(restored.totalAmount, 1000000);
  assert.strictEqual(restored.totalPaid, 500000);
  assert.strictEqual(restored.remainingAmount, 500000);
  assert.strictEqual(restored.payments.length, 2, "To'lovlar tarixi to'liq 2 ta bo'lib qolishi shart");
  assert.strictEqual(restored.schedule.length, 2, "To'lovlar jadvali saqlanishi shart");
  assert.strictEqual(restored.schedule[0].isPaid, true);
  assert.strictEqual(restored.schedule[1].isPaid, false);
});

console.log("\n=================================================");
console.log(`NATIJA: ${passedTests}/${totalTests} ta test muvaffaqiyatli o'tdi!`);
console.log("=================================================");
