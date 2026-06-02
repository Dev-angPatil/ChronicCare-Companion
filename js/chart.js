/* ----------------------------------------------------
   SVG TRENDS CHART ENGINE MODULE (js/chart.js)
---------------------------------------------------- */

/**
 * Draws a line chart inside the target SVG element based on logs and clinical targets.
 */
export function renderSVGChart(svgElement, logs, activeChart, targets) {
  const width = 500;
  const height = 180;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  // Clear previous chart contents
  svgElement.innerHTML = "";

  if (!logs || logs.length === 0) return;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  if (activeChart === "glucose") {
    // 1. GLUCOSE CHARTING
    const minVal = 50;
    const maxVal = 220;

    const getX = (index) => paddingLeft + (index / (logs.length - 1)) * chartWidth;
    const getY = (val) => height - paddingBottom - ((val - minVal) / (maxVal - minVal)) * chartHeight;

    // Draw horizontal grid lines & axis labels
    const gridVals = [
      targets.glucoseHypoThreshold || 70, 
      targets.glucoseFastingTargetMin || 80, 
      targets.glucoseFastingTargetMax || 130, 
      180
    ];

    gridVals.forEach(g => {
      const y = getY(g);
      const line = createSVGLine(paddingLeft, y, width - paddingRight, y, "chart-grid-line");
      const text = createSVGText(paddingLeft - 8, y + 3, g, "chart-axis-text");
      text.setAttribute("text-anchor", "end");
      svgElement.appendChild(line);
      svgElement.appendChild(text);
    });

    // Draw Target Shaded Range (Min - Max fasting targets)
    const tMin = targets.glucoseFastingTargetMin || 80;
    const tMax = targets.glucoseFastingTargetMax || 130;
    const targetY1 = getY(tMax);
    const targetY2 = getY(tMin);

    const targetRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    targetRect.setAttribute("x", paddingLeft);
    targetRect.setAttribute("y", targetY1);
    targetRect.setAttribute("width", chartWidth);
    targetRect.setAttribute("height", targetY2 - targetY1);
    targetRect.setAttribute("class", "chart-target-range");
    svgElement.appendChild(targetRect);

    // Plot Points & Paths
    let pathD = "";
    logs.forEach((log, idx) => {
      if (log.glucose !== null && log.glucose !== undefined) {
        const x = getX(idx);
        const y = getY(log.glucose);
        if (pathD === "") {
          pathD = `M ${x} ${y}`;
        } else {
          pathD += ` L ${x} ${y}`;
        }
      }
    });

    if (pathD !== "") {
      const linePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      linePath.setAttribute("d", pathD);
      linePath.setAttribute("class", "chart-line chart-line-glucose");
      svgElement.appendChild(linePath);
    }

    // Add Date axis labels & Point circles
    logs.forEach((log, idx) => {
      const x = getX(idx);
      
      // X axis labels
      const dateText = createSVGText(x, height - 10, log.date, "chart-axis-text");
      dateText.setAttribute("text-anchor", "middle");
      svgElement.appendChild(dateText);

      // Points
      if (log.glucose !== null && log.glucose !== undefined) {
        const y = getY(log.glucose);
        const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("cx", x);
        dot.setAttribute("cy", y);
        dot.setAttribute("r", "4.5");
        dot.setAttribute("class", "chart-dot chart-dot-glucose");
        
        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.textContent = `${log.date}: ${log.glucose} mg/dL (Symptom: ${log.symptoms})`;
        dot.appendChild(title);
        svgElement.appendChild(dot);
      }
    });

  } else {
    // 2. BLOOD PRESSURE CHARTING
    const minVal = 50;
    const maxVal = 170;

    const getX = (index) => paddingLeft + (index / (logs.length - 1)) * chartWidth;
    const getY = (val) => height - paddingBottom - ((val - minVal) / (maxVal - minVal)) * chartHeight;

    // Draw horizontal grid lines
    const sysMax = targets.bpSystolicTargetMax || 130;
    const diaMax = targets.bpDiastolicTargetMax || 80;
    const gridVals = [diaMax, sysMax, 150];

    gridVals.forEach(g => {
      const y = getY(g);
      const line = createSVGLine(paddingLeft, y, width - paddingRight, y, "chart-grid-line");
      const text = createSVGText(paddingLeft - 8, y + 3, g, "chart-axis-text");
      text.setAttribute("text-anchor", "end");
      svgElement.appendChild(line);
      svgElement.appendChild(text);
    });

    // Plot Systolic & Diastolic Paths
    let sysPathD = "";
    let diaPathD = "";

    logs.forEach((log, idx) => {
      if (log.bp) {
        const [sys, dia] = log.bp.split("/").map(Number);
        const x = getX(idx);
        const ySys = getY(sys);
        const yDia = getY(dia);

        if (sysPathD === "") {
          sysPathD = `M ${x} ${ySys}`;
          diaPathD = `M ${x} ${yDia}`;
        } else {
          sysPathD += ` L ${x} ${ySys}`;
          diaPathD += ` L ${x} ${yDia}`;
        }
      }
    });

    if (sysPathD !== "") {
      const sysPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      sysPath.setAttribute("d", sysPathD);
      sysPath.setAttribute("class", "chart-line");
      sysPath.setAttribute("stroke", "#c27f38"); // Terracotta/Brown for Systolic
      svgElement.appendChild(sysPath);

      const diaPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      diaPath.setAttribute("d", diaPathD);
      diaPath.setAttribute("class", "chart-line");
      diaPath.setAttribute("stroke", "#5fa5b5"); // Soothing blue for Diastolic
      svgElement.appendChild(diaPath);
    }

    // Add Date axis labels & Point circles
    logs.forEach((log, idx) => {
      const x = getX(idx);
      
      const dateText = createSVGText(x, height - 10, log.date, "chart-axis-text");
      dateText.setAttribute("text-anchor", "middle");
      svgElement.appendChild(dateText);

      if (log.bp) {
        const [sys, dia] = log.bp.split("/").map(Number);
        const ySys = getY(sys);
        const yDia = getY(dia);

        // Systolic Dot
        const dotSys = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dotSys.setAttribute("cx", x);
        dotSys.setAttribute("cy", ySys);
        dotSys.setAttribute("r", "4");
        dotSys.setAttribute("class", "chart-dot");
        dotSys.setAttribute("stroke", "#c27f38");
        const titleSys = document.createElementNS("http://www.w3.org/2000/svg", "title");
        titleSys.textContent = `${log.date} Systolic: ${sys} mmHg`;
        dotSys.appendChild(titleSys);
        svgElement.appendChild(dotSys);

        // Diastolic Dot
        const dotDia = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dotDia.setAttribute("cx", x);
        dotDia.setAttribute("cy", yDia);
        dotDia.setAttribute("r", "4");
        dotDia.setAttribute("class", "chart-dot");
        dotDia.setAttribute("stroke", "#5fa5b5");
        const titleDia = document.createElementNS("http://www.w3.org/2000/svg", "title");
        titleDia.textContent = `${log.date} Diastolic: ${dia} mmHg`;
        dotDia.appendChild(titleDia);
        svgElement.appendChild(dotDia);
      }
    });
  }
}

/* ----------------------------------------------------
   SVG DOM HELPERS
---------------------------------------------------- */

function createSVGLine(x1, y1, x2, y2, className) {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", x1);
  line.setAttribute("y1", y1);
  line.setAttribute("x2", x2);
  line.setAttribute("y2", y2);
  line.setAttribute("class", className);
  return line;
}

function createSVGText(x, y, textContent, className) {
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", x);
  text.setAttribute("y", y);
  text.setAttribute("class", className);
  text.textContent = textContent;
  return text;
}
