// Size Guide Page JavaScript
document.addEventListener("DOMContentLoaded", function () {
  // Chart tabs
  const chartTabs = document.querySelectorAll(".chart-tab");
  const chartContents = document.querySelectorAll(".chart-content");

  chartTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const chart = tab.dataset.chart;

      chartTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      chartContents.forEach((content) => {
        content.classList.toggle("active", content.id === `chart-${chart}`);
      });
    });
  });

  // Size calculator
  const calculateBtn = document.getElementById("calculateSizeBtn");
  const underbustInput = document.getElementById("underbust");
  const bustInput = document.getElementById("bust");
  const sizeResult = document.getElementById("sizeResult");
  const recommendedSize = document.getElementById("recommendedSize");

  calculateBtn.addEventListener("click", () => {
    const underbust = parseInt(underbustInput.value);
    const bust = parseInt(bustInput.value);

    if (!underbust || !bust) {
      alert("Please enter both measurements");
      return;
    }

    // Calculate band size
    let bandSize;
    if (underbust < 68) bandSize = 30;
    else if (underbust < 73) bandSize = 32;
    else if (underbust < 78) bandSize = 34;
    else if (underbust < 83) bandSize = 36;
    else if (underbust < 88) bandSize = 38;
    else if (underbust < 93) bandSize = 40;
    else bandSize = 42;

    // Calculate cup size
    const difference = bust - underbust;
    let cupSize;
    if (difference < 11) cupSize = "A";
    else if (difference < 14) cupSize = "B";
    else if (difference < 17) cupSize = "C";
    else if (difference < 20) cupSize = "D";
    else if (difference < 23) cupSize = "DD";
    else cupSize = "E";

    recommendedSize.textContent = `${bandSize}${cupSize}`;
    sizeResult.style.display = "block";
  });
});
