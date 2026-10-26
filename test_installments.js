// test_installments.js
import assert from 'assert';
import {
  isInstallmentSupportedStoreType,
  INSTALLMENT_ALLOWED_STORE_TYPES
} from './src/config/storeTypes.js';
import {
  calculateInstallmentSummary,
  generateInstallmentSchedule,
  computeContractStatus,
  applyPaymentToContract,
  calculateInstallmentStats,
  getNextPaymentDate,
  addMonthsSafe,
  addWeeksSafe,
  getTashkentDateString
} from './src/utils/installmentUtils.js';

console.log("=========================================");
console.log("SAVATCHI — MUDDATLI TO'LOV TESTLARI");
console.log("=========================================\n");

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

// ─── TEST 1: Ruxsat etilgan 4 ta do'kon turi ─────────────────────────────────
runTest("1. Faqat 4 ta do'kon turida ruxsat berilgan", () => {
  // 4 ta ruxsat etilgan
  assert.strictEqual(isInstallmentSupportedStoreType('phone'), true, "Phone do'koni ruxsat etilishi kerak");
  assert.strictEqual(isInstallmentSupportedStoreType('construction'), true, "Qurilish do'koni ruxsat etilishi kerak");
  assert.strictEqual(isInstallmentSupportedStoreType('household'), true, "Uy-ro'zg'or do'koni ruxsat etilishi kerak");
  assert.strictEqual(isInstallmentSupportedStoreType('sport'), true, "Sport jihozlari do'koni ruxsat etilishi kerak");

  // O'zbekcha variantlar
  assert.strictEqual(isInstallmentSupportedStoreType('Telefon do‘koni'), true);
  assert.strictEqual(isInstallmentSupportedStoreType('Qurilish mollari'), true);
  assert.strictEqual(isInstallmentSupportedStoreType('Uy-ro‘zg‘or buyumlari'), true);
  assert.strictEqual(isInstallmentSupportedStoreType('Sport do‘koni'), true);
});

// ─── TEST 2: Qolgan 5 ta do'kon turida bloklangan ────────────────────────────
runTest("2. Qolgan 5 ta do'kon turida qat'iy taqiqlangan", () => {
  assert.strictEqual(isInstallmentSupportedStoreType('food'), false, "Oziq-ovqat bloklanishi shart");
  assert.strictEqual(isInstallmentSupportedStoreType('clothing'), false, "Kiyim-kechak bloklanishi shart");
  assert.strictEqual(isInstallmentSupportedStoreType('cosmetics'), false, "Kosmetika bloklanishi shart");
  assert.strictEqual(isInstallmentSupportedStoreType('accessories'), false, "Aksessuarlar bloklanishi shart");
  assert.strictEqual(isInstallmentSupportedStoreType('flower'), false, "Gul do'koni bloklanishi shart");
  assert.strictEqual(isInstallmentSupportedStoreType(null), false);
  assert.strictEqual(isInstallmentSupportedStoreType(''), false);
});

// ─── TEST 3: Matematika va Butun So'm yaxlitlash ─────────────────────────────
runTest("3. Butun so'm yaxlitlash: 1 000 000 so'm / 3 to'lov yig'indisi aynan 1 000 000 so'm", () => {
  const summary = calculateInstallmentSummary({
    items: [
      { price: 600000, qty: 1 },
      { price: 500000, qty: 1 }
    ],
    discount: 100000,
    downPayment: 0
  });

  assert.strictEqual(summary.subtotal, 1100000);
  assert.strictEqual(summary.discount, 100000);
  assert.strictEqual(summary.totalAmount, 1000000);
  assert.strictEqual(summary.remainingPrincipal, 1000000);

  const schedule = generateInstallmentSchedule({
    remainingPrincipal: summary.remainingPrincipal,
    paymentCount: 3,
    frequency: 'monthly',
    firstPaymentDate: '2026-11-01'
  });

  assert.strictEqual(schedule.length, 3);
  assert.strictEqual(schedule[0].amount, 333333);
  assert.strictEqual(schedule[1].amount, 333333);
  assert.strictEqual(schedule[2].amount, 333334, "Oxirgi to'lovga qoldiq 1 so'm qo'shilishi shart");

  const sumAll = schedule.reduce((sum, s) => sum + s.amount, 0);
  assert.strictEqual(sumAll, 1000000, "Jadval summalari yig'indisi aynan 1 000 000 so'm bo'lishi shart!");
});

// ─── TEST 4: Oy oxirlari va Kabisa yili hisoblash ────────────────────────────
runTest("4. Oy oxirlari va kabisa yillari (Jan 31 -> Feb 28, Feb 29 kabisa yilda)", () => {
  // Oddiy yil 2026: 31-yanvar + 1 oy = 28-fevral
  const d1 = addMonthsSafe('2026-01-31', 1);
  assert.strictEqual(d1, '2026-02-28', "2026-yilda fevral 28 kun bo'lishi kerak");

  // Kabisa yili 2028: 31-yanvar + 1 oy = 29-fevral
  const dLeap = addMonthsSafe('2028-01-31', 1);
  assert.strictEqual(dLeap, '2028-02-29', "Kabisa yilida fevral 29 kun bo'lishi kerak");

  // 31-mart + 1 oy = 30-aprel
  const dApril = addMonthsSafe('2026-03-31', 1);
  assert.strictEqual(dApril, '2026-04-30', "Aprel 30 kun bo'lishi kerak");

  // 31-may + 1 oy = 30-iyun
  const dJune = addMonthsSafe('2026-05-31', 1);
  assert.strictEqual(dJune, '2026-06-30', "Iyun 30 kun bo'lishi kerak");

  // Haftalik test: 2026-10-25 + 1 hafta = 2026-11-01
  const dWeek = addWeeksSafe('2026-10-25', 1);
  assert.strictEqual(dWeek, '2026-11-01');
});

// ─── TEST 5: Shartnoma holatlarini aniqlash (Status logic) ───────────────────
runTest("5. Shartnoma holatlarini aniqlash (Active, Due, Overdue, Completed, Cancelled)", () => {
  const today = '2026-10-25';

  // 1. Faol (kelajakdagi to'lovlar)
  const activeContract = {
    totalAmount: 1000000,
    totalPaid: 300000,
    remainingAmount: 700000,
    status: 'active',
    schedule: [
      { id: '1', dueDate: '2026-11-25', amount: 350000, paidAmount: 0, isPaid: false },
      { id: '2', dueDate: '2026-12-25', amount: 350000, paidAmount: 0, isPaid: false }
    ]
  };
  assert.strictEqual(computeContractStatus(activeContract, today), 'active');

  // 2. Bugun to'lov
  const dueContract = {
    totalAmount: 1000000,
    totalPaid: 300000,
    remainingAmount: 700000,
    status: 'active',
    schedule: [
      { id: '1', dueDate: '2026-10-25', amount: 350000, paidAmount: 0, isPaid: false },
      { id: '2', dueDate: '2026-11-25', amount: 350000, paidAmount: 0, isPaid: false }
    ]
  };
  assert.strictEqual(computeContractStatus(dueContract, today), 'due');

  // 3. Muddati o'tgan
  const overdueContract = {
    totalAmount: 1000000,
    totalPaid: 300000,
    remainingAmount: 700000,
    status: 'active',
    schedule: [
      { id: '1', dueDate: '2026-10-15', amount: 350000, paidAmount: 0, isPaid: false },
      { id: '2', dueDate: '2026-11-25', amount: 350000, paidAmount: 0, isPaid: false }
    ]
  };
  assert.strictEqual(computeContractStatus(overdueContract, today), 'overdue');

  // 4. To'liq to'langan
  const completedContract = {
    totalAmount: 1000000,
    totalPaid: 1000000,
    remainingAmount: 0,
    status: 'completed',
    schedule: [
      { id: '1', dueDate: '2026-10-15', amount: 500000, paidAmount: 500000, isPaid: true },
      { id: '2', dueDate: '2026-11-15', amount: 500000, paidAmount: 500000, isPaid: true }
    ]
  };
  assert.strictEqual(computeContractStatus(completedContract, today), 'completed');

  // 5. Bekor qilingan
  const cancelledContract = {
    totalAmount: 1000000,
    totalPaid: 200000,
    remainingAmount: 800000,
    status: 'cancelled',
    schedule: []
  };
  assert.strictEqual(computeContractStatus(cancelledContract, today), 'cancelled');
});

// ─── TEST 6: Qisman va To'liq to'lovlarni taqsimlash ─────────────────────────
runTest("6. Qisman va to'liq to'lovlarni taqsimlash", () => {
  const contract = {
    id: 'INS-001',
    contractNumber: 'SH-0001',
    customerName: 'Jasur Aliyev',
    totalAmount: 1000000,
    totalPaid: 100000,
    remainingAmount: 900000,
    schedule: [
      { id: 'sch-1', installmentIndex: 1, dueDate: '2026-10-01', amount: 300000, paidAmount: 0, isPaid: false },
      { id: 'sch-2', installmentIndex: 2, dueDate: '2026-11-01', amount: 300000, paidAmount: 0, isPaid: false },
      { id: 'sch-3', installmentIndex: 3, dueDate: '2026-12-01', amount: 300000, paidAmount: 0, isPaid: false }
    ],
    payments: []
  };

  // 400 000 so'm to'lov: 1-to'lov to'liq (300 000), 2-to'lov qisman (100 000)
  const { updatedContract, newPayment } = applyPaymentToContract(contract, {
    amount: 400000,
    date: '2026-10-25',
    paymentMethod: 'Karta',
    note: 'Qisman to\'lov'
  }, '2026-10-25');

  assert.strictEqual(newPayment.amount, 400000);
  assert.strictEqual(updatedContract.totalPaid, 500000);
  assert.strictEqual(updatedContract.remainingAmount, 500000);

  // 1-to'lov yopilgan
  assert.strictEqual(updatedContract.schedule[0].paidAmount, 300000);
  assert.strictEqual(updatedContract.schedule[0].isPaid, true);

  // 2-to'lov qisman
  assert.strictEqual(updatedContract.schedule[1].paidAmount, 100000);
  assert.strictEqual(updatedContract.schedule[1].isPaid, false);

  // 3-to'lov tegmagan
  assert.strictEqual(updatedContract.schedule[2].paidAmount, 0);
  assert.strictEqual(updatedContract.schedule[2].isPaid, false);

  // Keyingi to'lov sanasini topish: sch-2 hali to'liq emas
  assert.strictEqual(getNextPaymentDate(updatedContract), '2026-11-01');
});

// ─── TEST 7: Statistik kartalar hisob-kitobi ─────────────────────────────────
runTest("7. Haqiqiy statistik kartalar hisob-kitobi", () => {
  const contracts = [
    {
      id: '1',
      totalAmount: 1000000,
      remainingAmount: 600000,
      status: 'active',
      schedule: [
        { dueDate: '2026-10-01', amount: 300000, paidAmount: 0, isPaid: false }, // muddati o'tgan
        { dueDate: '2026-11-01', amount: 300000, paidAmount: 0, isPaid: false }
      ]
    },
    {
      id: '2',
      totalAmount: 500000,
      remainingAmount: 0,
      status: 'completed',
      schedule: [
        { dueDate: '2026-09-01', amount: 500000, paidAmount: 500000, isPaid: true }
      ]
    },
    {
      id: '3',
      totalAmount: 800000,
      remainingAmount: 800000,
      status: 'cancelled',
      schedule: []
    }
  ];

  const stats = calculateInstallmentStats(contracts, '2026-10-25');
  assert.strictEqual(stats.totalContracts, 3);
  assert.strictEqual(stats.activeContracts, 1);
  assert.strictEqual(stats.overduePaymentsCount, 1);
  assert.strictEqual(stats.remainingTotalSum, 600000);
});

// ─── TEST 8: Oylik rejim (1, 12, 48 ta to'lov va chegaralar) ──────────────────
runTest("8. Oylik to'lovlar jadvali: 1, 12, 48 to'lov va 48/0 chegaralari", () => {
  const principal = 10000000; // 10 mln so'm

  // 1 ta to'lov
  const s1 = generateInstallmentSchedule({ remainingPrincipal: principal, paymentCount: 1, frequency: 'monthly', firstPaymentDate: '2026-11-01' });
  assert.strictEqual(s1.length, 1);
  assert.strictEqual(s1[0].amount, 10000000);
  assert.strictEqual(s1.reduce((sum, it) => sum + it.amount, 0), principal);

  // 12 ta to'lov
  const s12 = generateInstallmentSchedule({ remainingPrincipal: principal, paymentCount: 12, frequency: 'monthly', firstPaymentDate: '2026-11-01' });
  assert.strictEqual(s12.length, 12);
  assert.strictEqual(s12.reduce((sum, it) => sum + it.amount, 0), principal);
  assert.strictEqual(s12[0].dueDate, '2026-11-01');
  assert.strictEqual(s12[11].dueDate, '2027-10-01');

  // 48 ta to'lov
  const s48 = generateInstallmentSchedule({ remainingPrincipal: principal, paymentCount: 48, frequency: 'monthly', firstPaymentDate: '2026-11-01' });
  assert.strictEqual(s48.length, 48);
  assert.strictEqual(s48.reduce((sum, it) => sum + it.amount, 0), principal);

  // Chegaradan tashqari: 60 ta kiritilganda 48 ga qisqaradi
  const sOver = generateInstallmentSchedule({ remainingPrincipal: principal, paymentCount: 60, frequency: 'monthly', firstPaymentDate: '2026-11-01' });
  assert.strictEqual(sOver.length, 48, "Oylikda 48 dan katta qiymat 48 ga qisqarishi kerak");
  assert.strictEqual(sOver.reduce((sum, it) => sum + it.amount, 0), principal);

  // 0 yoki manfiy kiritilganda 1 ga moslanadi
  const sZero = generateInstallmentSchedule({ remainingPrincipal: principal, paymentCount: 0, frequency: 'monthly', firstPaymentDate: '2026-11-01' });
  assert.strictEqual(sZero.length, 1, "0 kiritilganda kamida 1 to'lov bo'lishi kerak");
  const sNeg = generateInstallmentSchedule({ remainingPrincipal: principal, paymentCount: -5, frequency: 'monthly', firstPaymentDate: '2026-11-01' });
  assert.strictEqual(sNeg.length, 1, "Manfiy kiritilganda kamida 1 to'lov bo'lishi kerak");
});

// ─── TEST 9: Yillik rejim (1, 5, 15 ta to'lov va chegaralar) ──────────────────
runTest("9. Yillik to'lovlar jadvali: 1, 5, 15 to'lov va 15/0 chegaralari", () => {
  const principal = 30000000; // 30 mln so'm

  // 1 ta to'lov
  const s1 = generateInstallmentSchedule({ remainingPrincipal: principal, paymentCount: 1, frequency: 'yearly', firstPaymentDate: '2027-10-25' });
  assert.strictEqual(s1.length, 1);
  assert.strictEqual(s1[0].amount, 30000000);
  assert.strictEqual(s1[0].dueDate, '2027-10-25');
  assert.strictEqual(s1.reduce((sum, it) => sum + it.amount, 0), principal);

  // 5 ta to'lov
  const s5 = generateInstallmentSchedule({ remainingPrincipal: principal, paymentCount: 5, frequency: 'yearly', firstPaymentDate: '2027-10-25' });
  assert.strictEqual(s5.length, 5);
  assert.strictEqual(s5[0].dueDate, '2027-10-25');
  assert.strictEqual(s5[1].dueDate, '2028-10-25');
  assert.strictEqual(s5[2].dueDate, '2029-10-25');
  assert.strictEqual(s5[3].dueDate, '2030-10-25');
  assert.strictEqual(s5[4].dueDate, '2031-10-25');
  assert.strictEqual(s5.reduce((sum, it) => sum + it.amount, 0), principal);

  // 15 ta to'lov
  const s15 = generateInstallmentSchedule({ remainingPrincipal: principal, paymentCount: 15, frequency: 'yearly', firstPaymentDate: '2027-10-25' });
  assert.strictEqual(s15.length, 15);
  assert.strictEqual(s15[14].dueDate, '2041-10-25');
  assert.strictEqual(s15.reduce((sum, it) => sum + it.amount, 0), principal);

  // Chegaradan tashqari: 25 ta kiritilganda 15 ga qisqaradi
  const sOverYearly = generateInstallmentSchedule({ remainingPrincipal: principal, paymentCount: 25, frequency: 'yearly', firstPaymentDate: '2027-10-25' });
  assert.strictEqual(sOverYearly.length, 15, "Yillikda 15 dan katta qiymat 15 ga qisqarishi kerak");
  assert.strictEqual(sOverYearly.reduce((sum, it) => sum + it.amount, 0), principal);

  // Kabisa yili 29-fevral sanasida yillik test
  const sLeapYearly = generateInstallmentSchedule({ remainingPrincipal: 1000000, paymentCount: 3, frequency: 'yearly', firstPaymentDate: '2028-02-29' });
  assert.strictEqual(sLeapYearly[0].dueDate, '2028-02-29');
  assert.strictEqual(sLeapYearly[1].dueDate, '2029-02-28', "Kabisa bo'lmagan yilda 28-fevral bo'lishi kerak");
  assert.strictEqual(sLeapYearly[2].dueDate, '2030-02-28');
});

// ─── TEST 10: Davriylik almashtirilganda va qoldiq oxirgi to'lovga qo'shilishi ─
runTest("10. Bo'linmaydigan summalar: Yig'indi 100% teng bo'lishi va qoldiq oxirgi to'lovda", () => {
  // Masalan: 10 000 001 so'm 3 ga bo'linganda: 3 333 333 + 3 333 333 + 3 333 335
  const oddPrincipal = 10000001;
  const sMonthly = generateInstallmentSchedule({ remainingPrincipal: oddPrincipal, paymentCount: 3, frequency: 'monthly', firstPaymentDate: '2026-11-01' });
  assert.strictEqual(sMonthly[0].amount, 3333333);
  assert.strictEqual(sMonthly[1].amount, 3333333);
  assert.strictEqual(sMonthly[2].amount, 3333335, "Qolgan 2 so'm oxirgi to'lovga to'liq qo'shilgan");
  assert.strictEqual(sMonthly.reduce((s, it) => s + it.amount, 0), oddPrincipal);

  // Yillik 7 ta to'lov uchun
  const sYearly = generateInstallmentSchedule({ remainingPrincipal: oddPrincipal, paymentCount: 7, frequency: 'yearly', firstPaymentDate: '2027-01-01' });
  assert.strictEqual(sYearly.length, 7);
  assert.strictEqual(sYearly.reduce((s, it) => s + it.amount, 0), oddPrincipal);
});

console.log(`\n=========================================`);
console.log(`NATIJA: ${passedTests}/${totalTests} ta test muvaffaqiyatli o'tdi!`);
console.log(`=========================================\n`);

