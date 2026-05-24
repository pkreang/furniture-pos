<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { fetchSalesOrder, type SalesOrder, type DeliveryInfo } from "../api/sales-orders";
import { fetchSettings } from "../api/admin";

const { t } = useI18n();
const route = useRoute();

const so = ref<SalesOrder | null>(null);
const settings = ref<Record<string, string>>({});
const error = ref<string | null>(null);
const loaded = ref(false);

const ITEM_ROWS = 8;

function money(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return n.toLocaleString();
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("th-TH");
}

const outstanding = computed(() => {
  if (!so.value) return 0;
  return Math.max(0, so.value.totalAmount - so.value.deposit);
});

const itemRows = computed(() => {
  const items = so.value?.items ?? [];
  const padded = [...items];
  while (padded.length < ITEM_ROWS) padded.push(null as never);
  return padded.slice(0, Math.max(ITEM_ROWS, padded.length));
});

const survey = computed<DeliveryInfo>(() => so.value?.deliveryInfo ?? {});

function print(): void {
  window.print();
}

function legalNotes(): string[] {
  return [
    "1. การจองครั้งนี้ ลูกค้าจะต้องชำระเงินมัดจำตามที่ระบุไว้ในใบจองในวันที่จอง บริษัทขอสงวนสิทธิ์ไม่คืนเงินมัดจำในทุกกรณี",
    "2. กรณีสั่งทำพิเศษ (made to order) เช่น เลือกผ้า / สี / ขนาด ที่ไม่ใช่สต็อก จะใช้เวลาผลิตประมาณ 30-45 วัน นับจากวันจอง บริษัทขอสงวนสิทธิ์ไม่รับคืนหรือเปลี่ยนสินค้าทุกกรณี",
    "3. เมื่อสินค้าพร้อมส่ง ลูกค้าต้องชำระยอดคงเหลือทั้งหมดให้ครบก่อนการจัดส่ง หากเกินกำหนด 7 วัน บริษัทถือว่าลูกค้าสละสิทธิ์การจองและไม่คืนเงินมัดจำ",
    "4. กรณีจัดส่งฟรีเฉพาะในเขตที่บริษัทกำหนด นอกพื้นที่คิดค่าจัดส่งเพิ่มเติม ลูกค้าเป็นผู้รับผิดชอบค่าขนย้ายขึ้นชั้นบนหรือยกเข้าซอยที่รถใหญ่เข้าไม่ได้",
    "5. ลูกค้ามีหน้าที่ตรวจสอบสภาพสินค้าก่อนรับสินค้า หากพบความเสียหาย โปรดแจ้งเจ้าหน้าที่ทันที บริษัทจะไม่รับผิดชอบความเสียหายที่เกิดภายหลังการรับสินค้า",
  ];
}

onMounted(async () => {
  try {
    settings.value = await fetchSettings();
    so.value = await fetchSalesOrder(Number(route.params.id));
  } catch (e) {
    error.value = e instanceof Error ? e.message : "unknown error";
  } finally {
    loaded.value = true;
  }
});
</script>

<template>
  <div class="bg-slate-50 min-h-screen py-4 print:bg-white print:py-0">
    <button
      type="button"
      class="btn-primary print:hidden mb-4 mx-auto block"
      @click="print"
    >
      {{ t("printBooking") }}
    </button>

    <p v-if="!loaded" class="text-center text-slate-500">…</p>
    <p v-else-if="error" class="text-center text-red-600">{{ error }}</p>

    <article
      v-else-if="so"
      class="max-w-[210mm] mx-auto bg-white text-slate-900 p-8 text-[11px] leading-tight print:p-0 print:max-w-none shadow print:shadow-none"
    >
      <!-- Header banner -->
      <div class="flex items-center justify-between bg-blue-900 text-white px-4 py-3 mb-3">
        <div class="text-2xl font-extrabold tracking-wider">ELITE DESIGN</div>
        <div class="text-right">
          <div class="text-xl font-bold tracking-wider">{{ t("orderSheet") }}</div>
          <div class="text-sm">{{ t("bookingSlip") }}</div>
        </div>
      </div>

      <!-- Contact row -->
      <div class="grid grid-cols-2 gap-2 mb-2 border border-slate-900 px-2 py-1">
        <div>
          <span class="font-semibold">{{ t("branches") }}:</span>
          {{ so.branch?.name ?? "" }}
          <span v-if="settings['company.phone']" class="ml-2">
            <span class="font-semibold">{{ t("phone") }}:</span>
            {{ settings["company.phone"] }}
          </span>
        </div>
        <div class="text-right">
          <span v-if="settings['company.callcenter']" class="mr-3">
            <span class="font-semibold">{{ t("callCenter") }}:</span>
            {{ settings["company.callcenter"] }}
          </span>
          <span v-if="settings['company.fax']">
            <span class="font-semibold">{{ t("fax") }}:</span>
            {{ settings["company.fax"] }}
          </span>
        </div>
      </div>

      <!-- Book / Doc row -->
      <div class="grid grid-cols-2 gap-2 mb-2">
        <div>
          <span class="font-semibold">เล่มที่ / Book No.:</span>
          <span class="border-b border-slate-900 inline-block min-w-[80px] ml-1 px-1">{{ so.bookNo ?? "" }}</span>
        </div>
        <div class="text-right">
          <span class="font-semibold">เลขที่ / No.:</span>
          <span class="border-b border-slate-900 inline-block min-w-[120px] ml-1 px-1">{{ so.code }}</span>
          <span class="ml-3 font-semibold">{{ t("orderDate") }}:</span>
          <span class="border-b border-slate-900 inline-block min-w-[100px] ml-1 px-1">{{ formatDate(so.orderDate) }}</span>
        </div>
      </div>

      <!-- Billing block -->
      <div class="border border-slate-900 px-2 py-1 mb-2">
        <div class="mb-1">
          <span class="font-semibold">ชื่อลูกค้า / Customer:</span>
          <span class="border-b border-slate-900 inline-block min-w-[200px] ml-1 px-1">{{ so.customer?.name ?? "" }}</span>
          <span class="ml-3 font-semibold">{{ t("phone") }}:</span>
          <span class="border-b border-slate-900 inline-block min-w-[100px] ml-1 px-1">{{ so.customer?.phone ?? "" }}</span>
          <span v-if="so.customerPhone2" class="ml-2">/ {{ so.customerPhone2 }}</span>
        </div>

        <div class="grid grid-cols-12 gap-2 mb-1">
          <div class="col-span-5">
            <span class="font-semibold">{{ t("addrLine1") }}:</span>
            <span class="border-b border-slate-900 inline-block min-w-[120px] ml-1 px-1">{{ so.addrLine1 ?? "" }}</span>
          </div>
          <div class="col-span-2">
            <span class="font-semibold">{{ t("addrMoo") }}:</span>
            <span class="border-b border-slate-900 inline-block min-w-[40px] ml-1 px-1">{{ so.addrMoo ?? "" }}</span>
          </div>
          <div class="col-span-2">
            <span class="font-semibold">{{ t("addrSoi") }}:</span>
            <span class="border-b border-slate-900 inline-block min-w-[40px] ml-1 px-1">{{ so.addrSoi ?? "" }}</span>
          </div>
          <div class="col-span-3">
            <span class="font-semibold">{{ t("addrStreet") }}:</span>
            <span class="border-b border-slate-900 inline-block min-w-[60px] ml-1 px-1">{{ so.addrStreet ?? "" }}</span>
          </div>
        </div>

        <div class="grid grid-cols-12 gap-2 mb-1">
          <div class="col-span-3">
            <span class="font-semibold">{{ t("addrKwang") }}:</span>
            <span class="border-b border-slate-900 inline-block min-w-[60px] ml-1 px-1">{{ so.addrKwang ?? "" }}</span>
          </div>
          <div class="col-span-3">
            <span class="font-semibold">{{ t("addrDistrict") }}:</span>
            <span class="border-b border-slate-900 inline-block min-w-[60px] ml-1 px-1">{{ so.addrDistrict ?? "" }}</span>
          </div>
          <div class="col-span-3">
            <span class="font-semibold">{{ t("addrProvince") }}:</span>
            <span class="border-b border-slate-900 inline-block min-w-[60px] ml-1 px-1">{{ so.addrProvince ?? "" }}</span>
          </div>
          <div class="col-span-3">
            <span class="font-semibold">{{ t("addrPostal") }}:</span>
            <span class="border-b border-slate-900 inline-block min-w-[60px] ml-1 px-1">{{ so.addrPostal ?? "" }}</span>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <div>
            <span class="font-semibold">{{ t("taxId") }}:</span>
            <span class="border-b border-slate-900 inline-block min-w-[140px] ml-1 px-1">{{ so.customer?.taxId ?? "" }}</span>
          </div>
          <div>
            <span class="inline-block w-3 h-3 border border-slate-900 mr-1 text-center text-[9px] leading-3 align-middle">
              {{ so.billingType === "HEAD_OFFICE" ? "✓" : "" }}
            </span>
            {{ t("headOffice") }}
          </div>
          <div>
            <span class="inline-block w-3 h-3 border border-slate-900 mr-1 text-center text-[9px] leading-3 align-middle">
              {{ so.billingType === "BRANCH" ? "✓" : "" }}
            </span>
            {{ t("branchOffice") }}
            <span v-if="so.billingType === 'BRANCH' && so.billingBranchNo" class="ml-1">
              ({{ so.billingBranchNo }})
            </span>
          </div>
        </div>
      </div>

      <!-- Items table -->
      <table class="w-full border-collapse border border-slate-900 mb-2">
        <thead class="bg-slate-100">
          <tr>
            <th class="border border-slate-900 px-1 py-1 w-8">ลำดับ</th>
            <th class="border border-slate-900 px-1 py-1">{{ t("products") }}</th>
            <th class="border border-slate-900 px-1 py-1 w-20">{{ t("itemSize") }}</th>
            <th class="border border-slate-900 px-1 py-1 w-24">{{ t("itemMaterials") }}</th>
            <th class="border border-slate-900 px-1 py-1 w-20">{{ t("itemColor") }}</th>
            <th class="border border-slate-900 px-1 py-1 w-12">{{ t("quantity") }}</th>
            <th class="border border-slate-900 px-1 py-1 w-20">{{ t("price") }}</th>
            <th class="border border-slate-900 px-1 py-1 w-24">{{ t("total") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(it, idx) in itemRows" :key="idx" class="h-6">
            <td class="border border-slate-900 px-1 text-center">{{ it ? idx + 1 : "" }}</td>
            <td class="border border-slate-900 px-1">{{ it?.product?.name ?? "" }}</td>
            <td class="border border-slate-900 px-1">{{ it?.size ?? "" }}</td>
            <td class="border border-slate-900 px-1">{{ it?.materials ?? "" }}</td>
            <td class="border border-slate-900 px-1">{{ it?.color ?? "" }}</td>
            <td class="border border-slate-900 px-1 text-right">{{ it ? it.quantity : "" }}</td>
            <td class="border border-slate-900 px-1 text-right">{{ it ? money(it.unitPrice) : "" }}</td>
            <td class="border border-slate-900 px-1 text-right">{{ it ? money(it.lineTotal) : "" }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Bottom: more info + totals -->
      <div class="grid grid-cols-3 gap-2 mb-2">
        <div class="col-span-2 border border-slate-900 p-2">
          <div class="font-semibold mb-1">{{ t("additionalInfo") }}</div>
          <div class="whitespace-pre-wrap min-h-[60px]">{{ so.notes ?? "" }}</div>
        </div>
        <div class="border border-slate-900 p-2">
          <div class="flex justify-between mb-1">
            <span class="font-semibold">{{ t("total") }}</span>
            <span>{{ money(so.totalAmount) }}</span>
          </div>
          <div class="flex justify-between mb-1">
            <span class="font-semibold">{{ t("deposit") }}</span>
            <span>{{ money(so.deposit) }}</span>
          </div>
          <div class="flex justify-between border-t border-slate-900 pt-1 font-semibold">
            <span>{{ t("outstanding") }}</span>
            <span>{{ money(outstanding) }}</span>
          </div>
        </div>
      </div>

      <!-- Two-column lower section -->
      <div class="grid grid-cols-2 gap-2 mb-2">
        <!-- Delivery survey -->
        <div class="border border-slate-900 p-2">
          <div class="font-semibold mb-1">{{ t("deliverySurvey") }}</div>
          <ol class="list-decimal pl-5 space-y-1">
            <li>{{ t("survey1") }}: {{ survey.floor ?? "" }}</li>
            <li>{{ t("survey2") }}: {{ survey.roomDoor ?? "" }}</li>
            <li>{{ t("survey3") }}: {{ survey.preRoomDoor ?? "" }}</li>
            <li>
              {{ t("survey4") }}:
              <span class="inline-block w-3 h-3 border border-slate-900 mr-1 text-center text-[9px] leading-3 align-middle">
                {{ survey.hasLift === true ? "✓" : "" }}
              </span>
              {{ t("yes") }}
              <span class="inline-block w-3 h-3 border border-slate-900 ml-2 mr-1 text-center text-[9px] leading-3 align-middle">
                {{ survey.hasLift === false ? "✓" : "" }}
              </span>
              {{ t("no") }}
            </li>
            <li>{{ t("survey5") }}: {{ survey.liftDoor ?? "" }}</li>
            <li>{{ t("survey6") }}: {{ survey.liftInterior ?? "" }}</li>
            <li>
              {{ t("survey7") }}:
              <span class="inline-block w-3 h-3 border border-slate-900 mr-1 text-center text-[9px] leading-3 align-middle">
                {{ survey.hasDoorBeforeLift === true ? "✓" : "" }}
              </span>
              {{ t("yes") }}
              <span class="inline-block w-3 h-3 border border-slate-900 ml-2 mr-1 text-center text-[9px] leading-3 align-middle">
                {{ survey.hasDoorBeforeLift === false ? "✓" : "" }}
              </span>
              {{ t("no") }}
              <span v-if="survey.doorBeforeLiftSize"> ({{ survey.doorBeforeLiftSize }})</span>
            </li>
            <li>{{ t("survey8") }}: {{ survey.stair ?? "" }}</li>
            <li>
              {{ t("survey9") }}:
              <span class="inline-block w-3 h-3 border border-slate-900 mr-1 text-center text-[9px] leading-3 align-middle">
                {{ survey.stairTurns === true ? "✓" : "" }}
              </span>
              {{ t("yes") }}
              <span class="inline-block w-3 h-3 border border-slate-900 ml-2 mr-1 text-center text-[9px] leading-3 align-middle">
                {{ survey.stairTurns === false ? "✓" : "" }}
              </span>
              {{ t("no") }}
              <span v-if="survey.stairTurnsSize"> ({{ survey.stairTurnsSize }})</span>
            </li>
            <li>
              {{ t("survey10") }}: {{ survey.ceilingHeight ?? "" }}
              <span v-if="survey.ceilingObstacles"> / {{ survey.ceilingObstacles }}</span>
            </li>
          </ol>
        </div>

        <!-- Delivery & payment checkboxes -->
        <div class="border border-slate-900 p-2 space-y-2">
          <div>
            <div class="font-semibold mb-1">{{ t("dueDate") }}</div>
            <div>{{ formatDate(so.dueDate) }}</div>
            <div class="mt-1">
              <span class="inline-block w-3 h-3 border border-slate-900 mr-1 text-center text-[9px] leading-3 align-middle">
                {{ so.canShipImmediately ? "✓" : "" }}
              </span>
              {{ t("canShipImmediately") }}
            </div>
          </div>

          <div>
            <div class="font-semibold mb-1">{{ t("deliveryType") }}</div>
            <div class="flex flex-wrap gap-3">
              <div>
                <span class="inline-block w-3 h-3 border border-slate-900 mr-1 text-center text-[9px] leading-3 align-middle">
                  {{ so.deliveryType === "COMPANY" ? "✓" : "" }}
                </span>
                {{ t("deliveryTypeCompany") }}
              </div>
              <div>
                <span class="inline-block w-3 h-3 border border-slate-900 mr-1 text-center text-[9px] leading-3 align-middle">
                  {{ so.deliveryType === "SELF_PICKUP" ? "✓" : "" }}
                </span>
                {{ t("deliveryTypeSelf") }}
              </div>
              <div>
                <span class="inline-block w-3 h-3 border border-slate-900 mr-1 text-center text-[9px] leading-3 align-middle">
                  {{ so.deliveryType === "OTHER" ? "✓" : "" }}
                </span>
                {{ t("deliveryTypeOther") }}
                <span v-if="so.deliveryType === 'OTHER' && so.deliveryTypeOther">
                  ({{ so.deliveryTypeOther }})
                </span>
              </div>
            </div>
          </div>

          <div>
            <div class="font-semibold mb-1">{{ t("paymentTerm") }}</div>
            <div class="flex flex-wrap gap-3">
              <div>
                <span class="inline-block w-3 h-3 border border-slate-900 mr-1 text-center text-[9px] leading-3 align-middle">
                  {{ so.paymentTerm === "DEPOSIT" ? "✓" : "" }}
                </span>
                {{ t("paymentTermDeposit") }}
              </div>
              <div>
                <span class="inline-block w-3 h-3 border border-slate-900 mr-1 text-center text-[9px] leading-3 align-middle">
                  {{ so.paymentTerm === "FULL" ? "✓" : "" }}
                </span>
                {{ t("paymentTermFull") }}
              </div>
              <div>
                <span class="inline-block w-3 h-3 border border-slate-900 mr-1 text-center text-[9px] leading-3 align-middle">
                  {{ so.paymentTerm === "INSTALLMENT" ? "✓" : "" }}
                </span>
                {{ t("paymentTermInstallment") }}
                <span v-if="so.paymentTerm === 'INSTALLMENT' && so.installmentMonths">
                  ({{ so.installmentMonths }} {{ t("monthsUnit") }})
                </span>
              </div>
            </div>
          </div>

          <div>
            <div class="font-semibold mb-1">{{ t("depositMethodSection") }}</div>
            <div class="flex flex-wrap gap-3">
              <div>
                <span class="inline-block w-3 h-3 border border-slate-900 mr-1 text-center text-[9px] leading-3 align-middle">
                  {{ so.depositMethod === "CASH" ? "✓" : "" }}
                </span>
                {{ t("methodCash") }}
              </div>
              <div>
                <span class="inline-block w-3 h-3 border border-slate-900 mr-1 text-center text-[9px] leading-3 align-middle">
                  {{ so.depositMethod === "TRANSFER" ? "✓" : "" }}
                </span>
                {{ t("methodTransfer") }}
              </div>
              <div>
                <span class="inline-block w-3 h-3 border border-slate-900 mr-1 text-center text-[9px] leading-3 align-middle">
                  {{ so.depositMethod === "CREDIT_CARD" ? "✓" : "" }}
                </span>
                {{ t("methodCard") }}
                <template v-if="so.depositMethod === 'CREDIT_CARD'">
                  <span class="ml-2">
                    <span class="inline-block w-3 h-3 border border-slate-900 mr-1 text-center text-[9px] leading-3 align-middle">{{ so.depositCardType === "VISA" ? "✓" : "" }}</span>
                    {{ t("cardVisa") }}
                  </span>
                  <span class="ml-1">
                    <span class="inline-block w-3 h-3 border border-slate-900 mr-1 text-center text-[9px] leading-3 align-middle">{{ so.depositCardType === "MASTERCARD" ? "✓" : "" }}</span>
                    {{ t("cardMaster") }}
                  </span>
                  <span class="ml-1">
                    <span class="inline-block w-3 h-3 border border-slate-900 mr-1 text-center text-[9px] leading-3 align-middle">{{ so.depositCardType === "OTHER" ? "✓" : "" }}</span>
                    {{ t("cardOther") }}
                  </span>
                </template>
              </div>
            </div>
          </div>

          <div>
            <div class="font-semibold mb-1">{{ t("balanceMethodSection") }}</div>
            <div class="flex flex-wrap gap-3">
              <div>
                <span class="inline-block w-3 h-3 border border-slate-900 mr-1 text-center text-[9px] leading-3 align-middle">
                  {{ so.balanceMethod === "CASH" ? "✓" : "" }}
                </span>
                {{ t("methodCash") }}
              </div>
              <div>
                <span class="inline-block w-3 h-3 border border-slate-900 mr-1 text-center text-[9px] leading-3 align-middle">
                  {{ so.balanceMethod === "TRANSFER" ? "✓" : "" }}
                </span>
                {{ t("methodTransfer") }}
              </div>
              <div>
                <span class="inline-block w-3 h-3 border border-slate-900 mr-1 text-center text-[9px] leading-3 align-middle">
                  {{ so.balanceMethod === "CREDIT_CARD" ? "✓" : "" }}
                </span>
                {{ t("methodCard") }}
                <template v-if="so.balanceMethod === 'CREDIT_CARD'">
                  <span class="ml-2">
                    <span class="inline-block w-3 h-3 border border-slate-900 mr-1 text-center text-[9px] leading-3 align-middle">{{ so.balanceCardType === "VISA" ? "✓" : "" }}</span>
                    {{ t("cardVisa") }}
                  </span>
                  <span class="ml-1">
                    <span class="inline-block w-3 h-3 border border-slate-900 mr-1 text-center text-[9px] leading-3 align-middle">{{ so.balanceCardType === "MASTERCARD" ? "✓" : "" }}</span>
                    {{ t("cardMaster") }}
                  </span>
                  <span class="ml-1">
                    <span class="inline-block w-3 h-3 border border-slate-900 mr-1 text-center text-[9px] leading-3 align-middle">{{ so.balanceCardType === "OTHER" ? "✓" : "" }}</span>
                    {{ t("cardOther") }}
                  </span>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Legal notes -->
      <div class="border border-slate-900 p-2 mb-3 text-[10px] leading-snug">
        <p v-for="(note, i) in legalNotes()" :key="i" class="mb-1">{{ note }}</p>
      </div>

      <!-- Signature lines -->
      <div class="grid grid-cols-2 gap-8 mt-6">
        <div class="text-center">
          <div class="border-t border-slate-900 pt-1 mt-8 mx-4">
            {{ t("customerSignature") }}
          </div>
          <div class="mt-1">วันที่ / Date ............................</div>
        </div>
        <div class="text-center">
          <div class="border-t border-slate-900 pt-1 mt-8 mx-4">
            {{ t("salesSignature") }}
          </div>
          <div class="mt-1">วันที่ / Date ............................</div>
        </div>
      </div>
    </article>
  </div>
</template>

<style scoped>
@media print {
  @page {
    size: A4;
    margin: 10mm;
  }
}
</style>
