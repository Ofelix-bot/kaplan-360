// The shared receipt UI (plan §4, decisions Q18 and C6), used site-wide. See build-spec §7 for usage:
// every figure gets an <Fn id/>, every section is one <ReceiptSection receipts={views}> that ends with
// <SourceList/>, old chip slots use <SourceChip/>, and ReceiptHost (mounted once in the layout) is the drawer.

export { Fn } from "./Fn";
export { ReceiptHoverCard, ReceiptHoverPopup } from "./ReceiptHoverCard";
export { ReceiptDrawer, ReceiptFull } from "./ReceiptDrawer";
export { SourceList } from "./SourceList";
export { SourceChip } from "./SourceChip";
export { ReceiptSection, useReceiptNumber, useReceiptSection, type ReceiptSectionValue } from "./ReceiptSection";
export { ReceiptHost, registryViews, isRegistryId } from "./ReceiptHost";
export { Quote, ShotFrame } from "./Quote";
export { useDay, useSourceName, useViewText, useMatchLine, langOf } from "./text";
export { useReceiptDrawer } from "@/lib/receipts/store";
