/* ============================================
   LexiLearn — Lightweight Canvas Charts
   ============================================ */

/**
 * Draw a bar chart on a canvas.
 */
export function drawBarChart(canvas, data, options = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  const {
    barColor = '#6C63FF',
    barColorAlt = '#3B82F6',
    labelColor = '#9a9abb',
    gridColor = 'rgba(255,255,255,0.06)',
    paddingBottom = 32,
    paddingTop = 16,
    paddingLeft = 36,
    paddingRight = 12,
  } = options;

  const labels = data.map(d => d.label);
  const values = data.map(d => d.value);
  const maxVal = Math.max(...values, 1);

  const chartW = w - paddingLeft - paddingRight;
  const chartH = h - paddingTop - paddingBottom;
  const barW = Math.min(36, (chartW / labels.length) * 0.6);
  const gap = chartW / labels.length;

  // Grid lines
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = paddingTop + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(w - paddingRight, y);
    ctx.stroke();
  }

  // Y axis labels
  ctx.fillStyle = labelColor;
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const y = paddingTop + (chartH / 4) * i;
    const val = Math.round(maxVal * (1 - i / 4));
    ctx.fillText(val, paddingLeft - 8, y + 4);
  }

  // Bars
  values.forEach((val, i) => {
    const barH = (val / maxVal) * chartH;
    const x = paddingLeft + gap * i + (gap - barW) / 2;
    const y = paddingTop + chartH - barH;

    // Gradient bar
    const grad = ctx.createLinearGradient(x, y, x, y + barH);
    grad.addColorStop(0, barColor);
    grad.addColorStop(1, barColorAlt);
    ctx.fillStyle = grad;

    // Rounded top
    const r = Math.min(4, barW / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + barW - r, y);
    ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
    ctx.lineTo(x + barW, y + barH);
    ctx.lineTo(x, y + barH);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.fill();

    // Label
    ctx.fillStyle = labelColor;
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(labels[i], x + barW / 2, h - paddingBottom + 18);
  });
}

/**
 * Draw a donut chart on a canvas.
 */
export function drawDonutChart(canvas, segments, options = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  const {
    colors = ['#6C63FF', '#3B82F6', '#10B981', '#F59E0B'],
    innerRadius = 0.65,
    labelColor = '#e8e8f0',
  } = options;

  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(cx, cy) - 8;
  const inner = radius * innerRadius;

  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) {
    // Empty state
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = radius - inner;
    ctx.beginPath();
    ctx.arc(cx, cy, (radius + inner) / 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = labelColor;
    ctx.font = '600 14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No data', cx, cy);
    return;
  }

  let angle = -Math.PI / 2;

  segments.forEach((seg, i) => {
    const sliceAngle = (seg.value / total) * Math.PI * 2;
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.arc(cx, cy, radius, angle, angle + sliceAngle);
    ctx.arc(cx, cy, inner, angle + sliceAngle, angle, true);
    ctx.closePath();
    ctx.fill();
    angle += sliceAngle;
  });

  // Center text
  ctx.fillStyle = labelColor;
  ctx.font = '700 22px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(total, cx, cy - 6);
  ctx.font = '400 11px Inter, sans-serif';
  ctx.fillStyle = '#9a9abb';
  ctx.fillText('words', cx, cy + 14);
}
