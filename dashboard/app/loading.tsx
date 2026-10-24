import SamLoading from "../components/sam/SamLoading";

// Route loading state: Samaritan's calculating prompt rather than a skeleton
// of a layout that may not match the page being opened.
export default function DashboardLoading() {
  return <SamLoading label="Retrieving records" />;
}
