export default function filterByDate(reviews, startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  return reviews.filter(r => {
    const reviewDate = new Date(r.date);
    return reviewDate >= start && reviewDate <= end;
  });
}
