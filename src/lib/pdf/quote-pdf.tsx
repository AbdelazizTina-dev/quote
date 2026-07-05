import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import {
  depositCents,
  formatCents,
  formatTaxRate,
  quoteTotals,
  type LineItem,
  type Profile,
  type Quote,
} from "@/lib/types";

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#18181b",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  businessName: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  contact: { color: "#71717a", marginTop: 4, lineHeight: 1.5 },
  quoteMeta: { textAlign: "right", color: "#71717a", lineHeight: 1.5 },
  quoteTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#18181b",
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#a1a1aa",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  block: { marginBottom: 24 },
  table: { marginBottom: 8 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#18181b",
    paddingBottom: 6,
    fontFamily: "Helvetica-Bold",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e4e4e7",
    paddingVertical: 6,
  },
  colKind: { width: "14%" },
  colDescription: { width: "46%" },
  colQty: { width: "12%", textAlign: "right" },
  colPrice: { width: "14%", textAlign: "right" },
  colAmount: { width: "14%", textAlign: "right" },
  totalsBlock: {
    marginTop: 10,
    marginLeft: "auto",
    width: 200,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalsMuted: { color: "#52525b" },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#18181b",
    marginTop: 3,
    paddingTop: 6,
  },
  grandTotalText: { fontFamily: "Helvetica-Bold", fontSize: 12 },
  depositBox: {
    marginTop: 24,
    padding: 14,
    backgroundColor: "#fafafa",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  depositLabel: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  depositNote: { color: "#71717a", marginTop: 2 },
  depositValue: { fontFamily: "Helvetica-Bold", fontSize: 14 },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 48,
    right: 48,
    textAlign: "center",
    color: "#a1a1aa",
    fontSize: 8,
  },
});

function QuotePdf({
  quote,
  items,
  profile,
}: {
  quote: Quote;
  items: LineItem[];
  profile: Profile;
}) {
  const { subtotalCents, taxCents, totalCents } = quoteTotals(items, quote.tax_rate_bps);
  const depositDue = depositCents(totalCents, quote.deposit_type, quote.deposit_value);
  const issuedDate = new Date(quote.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Document
      title={`Quote ${quote.id.slice(0, 8)} — ${profile.business_name}`}
      author={profile.business_name}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.businessName}>{profile.business_name}</Text>
            <View style={styles.contact}>
              {profile.contact_email ? <Text>{profile.contact_email}</Text> : null}
              {profile.phone ? <Text>{profile.phone}</Text> : null}
            </View>
          </View>
          <View style={styles.quoteMeta}>
            <Text style={styles.quoteTitle}>QUOTE</Text>
            <Text>#{quote.id.slice(0, 8).toUpperCase()}</Text>
            <Text>{issuedDate}</Text>
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.sectionLabel}>Prepared for</Text>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11 }}>
            {quote.client_name || "—"}
          </Text>
          {quote.client_email ? <Text style={styles.contact}>{quote.client_email}</Text> : null}
          {quote.client_phone ? <Text style={styles.contact}>{quote.client_phone}</Text> : null}
        </View>

        {quote.job_description ? (
          <View style={styles.block}>
            <Text style={styles.sectionLabel}>Job description</Text>
            <Text style={{ lineHeight: 1.5 }}>{quote.job_description}</Text>
          </View>
        ) : null}

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colKind}>Type</Text>
            <Text style={styles.colDescription}>Description</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colPrice}>Unit price</Text>
            <Text style={styles.colAmount}>Amount</Text>
          </View>
          {items.map((item) => (
            <View key={item.id} style={styles.row}>
              <Text style={styles.colKind}>
                {item.kind === "labor" ? "Labor" : "Material"}
              </Text>
              <Text style={styles.colDescription}>{item.description}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>{formatCents(item.unit_price_cents)}</Text>
              <Text style={styles.colAmount}>
                {formatCents(Math.round(item.quantity * item.unit_price_cents))}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsMuted}>Subtotal</Text>
            <Text>{formatCents(subtotalCents)}</Text>
          </View>
          {quote.tax_rate_bps > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsMuted}>
                Tax ({formatTaxRate(quote.tax_rate_bps)})
              </Text>
              <Text>{formatCents(taxCents)}</Text>
            </View>
          ) : null}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalText}>Total</Text>
            <Text style={styles.grandTotalText}>{formatCents(totalCents)}</Text>
          </View>
        </View>

        <View style={styles.depositBox}>
          <View>
            <Text style={styles.depositLabel}>Deposit due to accept</Text>
            <Text style={styles.depositNote}>
              {quote.deposit_type === "percent"
                ? `${quote.deposit_value}% of total`
                : "Fixed deposit"}
              {" — remainder due on completion"}
            </Text>
          </View>
          <Text style={styles.depositValue}>{formatCents(depositDue)}</Text>
        </View>

        {quote.terms ? (
          <View style={{ marginTop: 28 }}>
            <Text style={styles.sectionLabel}>Notes &amp; terms</Text>
            <Text style={{ lineHeight: 1.5, color: "#52525b" }}>{quote.terms}</Text>
          </View>
        ) : null}

        <Text style={styles.footer}>
          {profile.business_name} — quote #{quote.id.slice(0, 8).toUpperCase()}, issued {issuedDate}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderQuotePdf(
  quote: Quote,
  items: LineItem[],
  profile: Profile
): Promise<Buffer> {
  return renderToBuffer(
    <QuotePdf quote={quote} items={items} profile={profile} />
  );
}
