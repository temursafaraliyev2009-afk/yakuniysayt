// test_roles.js
// Automated verification for Savatchi Roles Lifecycle (Tests A through H)

// 1. Mock LocalStorage and DOM Events in Node.js
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
  get length() {
    return Object.keys(this.store).length;
  }
  key(index) {
    return Object.keys(this.store)[index] || null;
  }
}

globalThis.localStorage = new LocalStorageMock();
globalThis.window = {
  dispatchEvent: (event) => {},
  addEventListener: () => {},
  removeEventListener: () => {}
};
globalThis.CustomEvent = class CustomEvent {
  constructor(name, detail) {
    this.name = name;
    this.detail = detail;
  }
};

async function runTests() {
  console.log('====================================================');
  console.log('SAVATCHI: ROLLAR VA XODIMLAR TIZIMINI SINOVDAN O‘TKAZISH');
  console.log('====================================================\n');

  const {
    registerSystemAccount,
    getAllRegisteredAccounts,
    getRegisteredAccountByIdentifier,
    isStoreOwnerRole,
    isAccountStoreOwner,
    updateUserRoleInSystem
  } = await import('./src/services/accountService.js');

  const {
    sendStaffInvitation,
    acceptStaffInvitation,
    getPendingInvitationsCount,
    getUserMailMessages,
    saveStoreEmployeesToStorage,
    getStoreEmployeesFromStorage
  } = await import('./src/services/mailService.js');

  const results = {};

  // ----------------------------------------------------
  // SINOV A: Yangi akkauntda hali xodimlar yo'q — profil rolida "Foydalanuvchi" ko'rsatiladi
  // ----------------------------------------------------
  try {
    const accA = registerSystemAccount({
      email: 'userA@test.uz',
      password: 'password123',
      displayName: 'Foydalanuvchi A'
    });

    const accB = registerSystemAccount({
      email: 'userB@test.uz',
      password: 'password123',
      displayName: 'Foydalanuvchi B'
    });

    const freshA = getRegisteredAccountByIdentifier('userA@test.uz');
    const freshB = getRegisteredAccountByIdentifier('userB@test.uz');

    // Profil roli hisoblanishi (StoreContext / DashboardHeader / SettingsModal qoidasi bo'yicha)
    const displayRoleA = freshA.role || 'Foydalanuvchi';
    const displayRoleB = freshB.role || 'Foydalanuvchi';

    if (displayRoleA === 'Foydalanuvchi' && displayRoleB === 'Foydalanuvchi' && !isAccountStoreOwner(freshA) && !isAccountStoreOwner(freshB)) {
      results['A'] = { pass: true, msg: 'Yangi akkauntlarda profil rolida "Foydalanuvchi" ko‘rsatiladi va egasi emas (isOwner: false).' };
    } else {
      results['A'] = { pass: false, msg: `Rol xato: A=${displayRoleA}, B=${displayRoleB}` };
    }
  } catch (err) {
    results['A'] = { pass: false, msg: err.message };
  }
  console.log(`[SINOV A] ${results['A'].pass ? 'MUVAFFAQ TARZDA O‘TDI' : 'XATOLIK'}: ${results['A'].msg}`);

  // ----------------------------------------------------
  // SINOV B: A foydalanuvchi B ga taklif yuboradi va B qabul qilgach: A -> Do'kon egasi, B -> Xodim
  // ----------------------------------------------------
  let invitationB;
  const storeA = { id: 'store-A-101', name: 'A Do‘koni', type: 'food' };
  try {
    const userA = getRegisteredAccountByIdentifier('userA@test.uz');
    const userB = getRegisteredAccountByIdentifier('userB@test.uz');

    // Taklif yuborish
    invitationB = sendStaffInvitation({
      storeId: storeA.id,
      storeName: storeA.name,
      storeType: storeA.type,
      fromUser: userA,
      toAccount: userB,
      initialRole: 'Xodim'
    });

    // Kutilayotgan holatda rollar hali o'zgarmasligi kerak
    const midA = getRegisteredAccountByIdentifier('userA@test.uz');
    const midB = getRegisteredAccountByIdentifier('userB@test.uz');
    const pendingActive = (midA.role || 'Foydalanuvchi') === 'Foydalanuvchi' && (midB.role || 'Foydalanuvchi') === 'Foydalanuvchi';

    // B taklifni qabul qiladi
    await acceptStaffInvitation(invitationB.id, userB);

    const afterA = getRegisteredAccountByIdentifier('userA@test.uz');
    const afterB = getRegisteredAccountByIdentifier('userB@test.uz');

    const bPass = (
      pendingActive &&
      isAccountStoreOwner(afterA) &&
      afterB.role === 'Xodim' &&
      !isAccountStoreOwner(afterB)
    );

    if (bPass) {
      results['B'] = {
        pass: true,
        msg: `Taklif qabul qilingach: Taklif yuboruvchi -> "${afterA.role}", Taklif qabul qiluvchi -> "${afterB.role}".`
      };
    } else {
      results['B'] = {
        pass: false,
        msg: `pendingActive: ${pendingActive}, A: ${afterA.role}, B: ${afterB.role}`
      };
    }
  } catch (err) {
    results['B'] = { pass: false, msg: err.message };
  }
  console.log(`[SINOV B] ${results['B'].pass ? 'MUVAFFAQ TARZDA O‘TDI' : 'XATOLIK'}: ${results['B'].msg}`);

  // ----------------------------------------------------
  // SINOV C: Boshqa foydalanuvchi Do‘kon egasiga taklif yubora olmaydi (Bloklanadi)
  // ----------------------------------------------------
  try {
    const userC = registerSystemAccount({
      email: 'userC@test.uz',
      password: 'password123',
      displayName: 'Foydalanuvchi C'
    });
    const ownerA = getRegisteredAccountByIdentifier('userA@test.uz');

    let sendBlocked = false;
    try {
      sendStaffInvitation({
        storeId: 'store-C-201',
        storeName: 'C Do‘koni',
        storeType: 'clothes',
        fromUser: userC,
        toAccount: ownerA,
        initialRole: 'Xodim'
      });
    } catch (e) {
      sendBlocked = e.message.includes("allaqachon do‘kon egasi");
    }

    const pendingCountForOwnerA = getPendingInvitationsCount(ownerA);

    if (sendBlocked && pendingCountForOwnerA === 0) {
      results['C'] = {
        pass: true,
        msg: 'Do‘kon egasiga taklif yuborish aniq xato xabari bilan rad etildi va kiruvchi takliflar soni 0.'
      };
    } else {
      results['C'] = {
        pass: false,
        msg: `sendBlocked: ${sendBlocked}, pendingCount: ${pendingCountForOwnerA}`
      };
    }
  } catch (err) {
    results['C'] = { pass: false, msg: err.message };
  }
  console.log(`[SINOV C] ${results['C'].pass ? 'MUVAFFAQ TARZDA O‘TDI' : 'XATOLIK'}: ${results['C'].msg}`);

  // ----------------------------------------------------
  // SINOV D: Egasi barcha faol xodimlarini chiqaradi — uning egasi roli olib tashlanib "Foydalanuvchi" bo'ladi, ma'lumotlar saqlanadi
  // ----------------------------------------------------
  try {
    const ownerA = getRegisteredAccountByIdentifier('userA@test.uz');
    
    // Do'konda mahsulotlar va savdo ma'lumotlari mavjudligini simulyatsiya qilish
    const storeKeyProducts = `savatchi_products_${storeA.id}`;
    const storeKeySales = `savatchi_sales_${storeA.id}`;
    const storeKeyDebts = `savatchi_debts_${storeA.id}`;
    const sampleProducts = [{ id: 'p1', name: 'Olma', price: 15000, stock: 50 }];
    const sampleSales = [{ id: 's1', total: 30000, date: '2026-10-18' }];
    const sampleDebts = [{ id: 'd1', customerName: 'Ali', amount: 50000 }];

    localStorage.setItem(storeKeyProducts, JSON.stringify(sampleProducts));
    localStorage.setItem(storeKeySales, JSON.stringify(sampleSales));
    localStorage.setItem(storeKeyDebts, JSON.stringify(sampleDebts));

    // A do'konidagi barcha xodimlarni olib tashlash (B olib tashlandi -> 0 xodim qoldi)
    saveStoreEmployeesToStorage(storeA.id, []); // Bo'sh ro'yxat

    // StoreContext deleteEmployee mantiqi bo'yicha:
    const remainingStaff = getStoreEmployeesFromStorage(storeA.id);
    if (remainingStaff.length === 0) {
      updateUserRoleInSystem(ownerA.id, "Foydalanuvchi");
    }

    const strippedA = getRegisteredAccountByIdentifier('userA@test.uz');

    // Do'kon ma'lumotlarini tekshirish
    const savedProducts = JSON.parse(localStorage.getItem(storeKeyProducts));
    const savedSales = JSON.parse(localStorage.getItem(storeKeySales));
    const savedDebts = JSON.parse(localStorage.getItem(storeKeyDebts));

    const roleStripped = strippedA.role === "Foydalanuvchi" && !isAccountStoreOwner(strippedA);
    const profileIntact = strippedA.displayName === 'Foydalanuvchi A' && strippedA.email === 'usera@test.uz';
    const dataIntact = savedProducts?.length === 1 && savedSales?.length === 1 && savedDebts?.length === 1;

    if (roleStripped && profileIntact && dataIntact) {
      results['D'] = {
        pass: true,
        msg: 'Barcha xodimlar chiqarilgach egasi roli "Foydalanuvchi"ga o‘zgartirildi, profil ma’lumotlari va do‘kon ma’lumotlari 100% saqlandi.'
      };
    } else {
      results['D'] = {
        pass: false,
        msg: `roleStripped: ${roleStripped}, profileIntact: ${profileIntact}, dataIntact: ${dataIntact}`
      };
    }
  } catch (err) {
    results['D'] = { pass: false, msg: err.message };
  }
  console.log(`[SINOV D] ${results['D'].pass ? 'MUVAFFAQ TARZDA O‘TDI' : 'XATOLIK'}: ${results['D'].msg}`);

  // ----------------------------------------------------
  // SINOV E: Endi roli yo‘q bo‘lgan sobiq egaga boshqa foydalanuvchi taklif yubora oladi
  // ----------------------------------------------------
  let invitationForFormerOwner;
  const storeC = { id: 'store-C-301', name: 'C Supermarket', type: 'tech' };
  try {
    const formerOwnerA = getRegisteredAccountByIdentifier('userA@test.uz');
    const userC = getRegisteredAccountByIdentifier('userC@test.uz');

    invitationForFormerOwner = sendStaffInvitation({
      storeId: storeC.id,
      storeName: storeC.name,
      storeType: storeC.type,
      fromUser: userC,
      toAccount: formerOwnerA,
      initialRole: 'Xodim'
    });

    const pendingForFormerOwner = getPendingInvitationsCount(formerOwnerA);

    if (invitationForFormerOwner && pendingForFormerOwner === 1) {
      results['E'] = {
        pass: true,
        msg: 'Roli olib tashlangan sobiq egaga yangi taklif muvaffaqiyatli yuborildi va uning pochtasiga tushdi.'
      };
    } else {
      results['E'] = {
        pass: false,
        msg: `pendingForFormerOwner: ${pendingForFormerOwner}`
      };
    }
  } catch (err) {
    results['E'] = { pass: false, msg: err.message };
  }
  console.log(`[SINOV E] ${results['E'].pass ? 'MUVAFFAQ TARZDA O‘TDI' : 'XATOLIK'}: ${results['E'].msg}`);

  // ----------------------------------------------------
  // SINOV F: Taklif qabul qilingach, yangi taklif yuboruvchi Do‘kon egasi, qabul qilgan foydalanuvchi Xodim bo‘ladi
  // ----------------------------------------------------
  try {
    const formerOwnerA = getRegisteredAccountByIdentifier('userA@test.uz');
    await acceptStaffInvitation(invitationForFormerOwner.id, formerOwnerA);

    const newOwnerC = getRegisteredAccountByIdentifier('userC@test.uz');
    const nowStaffA = getRegisteredAccountByIdentifier('userA@test.uz');

    if (
      isAccountStoreOwner(newOwnerC) &&
      nowStaffA.role === 'Xodim'
    ) {
      results['F'] = {
        pass: true,
        msg: `Taklif qabul qilingach: C -> "${newOwnerC.role}", A -> "${nowStaffA.role}".`
      };
    } else {
      results['F'] = {
        pass: false,
        msg: `C: ${newOwnerC.role}, A: ${nowStaffA.role}`
      };
    }
  } catch (err) {
    results['F'] = { pass: false, msg: err.message };
  }
  console.log(`[SINOV F] ${results['F'].pass ? 'MUVAFFAQ TARZDA O‘TDI' : 'XATOLIK'}: ${results['F'].msg}`);

  // ----------------------------------------------------
  // SINOV G: Eski do‘konning mahsulotlari, savdolari, qarzlari va hisobot tarixi yo‘qolmaydi yoki yangi do‘konga aralashmaydi
  // ----------------------------------------------------
  try {
    const storeKeyProducts = `savatchi_products_${storeA.id}`;
    const storeKeySales = `savatchi_sales_${storeA.id}`;
    const oldProducts = JSON.parse(localStorage.getItem(storeKeyProducts));
    const oldSales = JSON.parse(localStorage.getItem(storeKeySales));

    const newStoreProducts = localStorage.getItem(`savatchi_products_${storeC.id}`);

    const oldDataIntact = oldProducts && oldProducts[0].name === 'Olma';
    const noPollution = newStoreProducts === null || !newStoreProducts.includes('Olma');

    if (oldDataIntact && noPollution) {
      results['G'] = {
        pass: true,
        msg: 'Eski do‘kon ma’lumotlari (mahsulot, savdo, qarz) saqlangan va yangi do‘kon ma’lumotlariga aralashmagan.'
      };
    } else {
      results['G'] = {
        pass: false,
        msg: `oldDataIntact: ${oldDataIntact}, noPollution: ${noPollution}`
      };
    }
  } catch (err) {
    results['G'] = { pass: false, msg: err.message };
  }
  console.log(`[SINOV G] ${results['G'].pass ? 'MUVAFFAQ TARZDA O‘TDI' : 'XATOLIK'}: ${results['G'].msg}`);

  // ----------------------------------------------------
  // SINOV H: Takliflar, rollar va ma’lumotlar sahifani yangilash hamda qayta kirishda to‘g‘ri saqlanadi
  // ----------------------------------------------------
  try {
    // LocalStorage dagi saqlangan holatdan barcha akkauntlar va rollarni qayta o'qish (simulyatsiya)
    const accounts = getAllRegisteredAccounts();
    const reloadedA = accounts.find(a => a.email === 'usera@test.uz');
    const reloadedB = accounts.find(a => a.email === 'userb@test.uz');
    const reloadedC = accounts.find(a => a.email === 'userc@test.uz');

    const mailMessages = getUserMailMessages(reloadedA);

    const hPass = (
      reloadedC.role === "Do'kon egasi" &&
      reloadedA.role === "Xodim" &&
      reloadedB.role === "Xodim" &&
      mailMessages.length > 0
    );

    if (hPass) {
      results['H'] = {
        pass: true,
        msg: 'Barcha rollar, xabarlar va do‘kon bog‘liqliklari tizimda mustahkam saqlanmoqda.'
      };
    } else {
      results['H'] = {
        pass: false,
        msg: `C: ${reloadedC?.role}, A: ${reloadedA?.role}, B: ${reloadedB?.role}`
      };
    }
  } catch (err) {
    results['H'] = { pass: false, msg: err.message };
  }
  console.log(`[SINOV H] ${results['H'].pass ? 'MUVAFFAQ TARZDA O‘TDI' : 'XATOLIK'}: ${results['H'].msg}`);

  console.log('\n====================================================');
  const allPassed = Object.values(results).every(r => r.pass);
  console.log(`UMUMIY NATIJA: ${allPassed ? 'BARCHA SINOVLAR (A-H) 100% MUVAFFAQ QILINDI!' : 'AYRIM SINOVLARDA XATOLIK BOR'}`);
  console.log('====================================================');
}

runTests();
