"""
M/M/1 queueing model analysis for content moderation APIs.

Reads results/rate_*.jsonl files from the rate-experiment client,
fits M/M/1 models per API, and produces validation plots + tables.

Usage:
    python3 script/mm1-analysis.py
"""

import json
import math
import random
import statistics
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

# size = "short"
# size = "medium"
size = "long"
results = "results3/"
RESULTS_DIR = Path(results + size)
OUTPUT_DIR = Path(results +"analysis/" + size)

def load_results():
    files = sorted(RESULTS_DIR.glob("rate_*.jsonl"))
    if not files:
        print(f"No rate_*.jsonl files found in {RESULTS_DIR}/")
        print("Run rate-experiment first, e.g.: bun client:rate")
        sys.exit(1)

    data = {}
    for f in files:
        with open(f) as fh:
            rows = [json.loads(l) for l in fh if l.strip()]
        if not rows:
            continue
        method = rows[0].get("method", "unknown")
        lam = float(rows[0].get("lambda", 0))
        key = (method, lam)
        if key not in data:
            data[key] = []
        data[key].extend(rows)

    return data


def mm1_predict(mu, lam):
    rho = lam / mu
    if rho >= 1:
        return None, None, None, None
    L = rho / (1 - rho)
    Lq = rho**2 / (1 - rho)
    W = 1.0 / (mu - lam)
    Wq = rho / (mu - lam)
    return rho, L, Lq, W


def compute_metrics(data):
    metrics = {}
    for (method, lam), rows in sorted(data.items()):
        service_times = [r["latency_ms"] / 1000.0 for r in rows]
        inter_arrivals = [r["inter_arrival_ms"] / 1000.0 for r in rows]
        arrival_times = [r["arrival_timestamp"] / 1000.0 for r in rows]

        mu_hat = 1.0 / statistics.mean(service_times)
        rho, L_pred, Lq_pred, W_pred = mm1_predict(mu_hat, lam)

        W_meas = statistics.mean(service_times)

        # Bootstrap 95% CI on W
        boot_means = []
        for _ in range(2000):
            sampled = [random.choice(service_times) for _ in range(len(service_times))]
            boot_means.append(statistics.mean(sampled))
        boot_means.sort()
        ci_lower = boot_means[50]
        ci_upper = boot_means[1950]

        # total_duration = sum(inter_arrivals) + sum(service_times) if service_times else 0
        lastMessage = arrival_times[0] + service_times[0]
        for i in range(len(arrival_times)):
            lastMessage = max(lastMessage, arrival_times[i] + service_times[i])
        # total_duration = arrival_times[-1] + service_times[-1] - arrival_times[0]
        total_duration = lastMessage - arrival_times[0]
        print("Total duration",total_duration)
        measured_throughput = len(service_times) / total_duration if total_duration > 0 else 0
        correct_flags = [r.get("correct") for r in rows if r.get("correct") is not None]
        accuracy = statistics.mean(correct_flags) if correct_flags else None

        percent_error = abs(W_meas - W_pred) / W_pred * 100 if W_pred and W_pred > 0 else float("inf")

        metrics[(method, lam)] = {
            "n": len(rows),
            "mu": mu_hat,
            "rho": rho,
            "W_pred": W_pred,
            "W_meas": W_meas,
            "W_ci": (ci_lower, ci_upper),
            "L_pred": L_pred,
            "Lq_pred": Lq_pred,
            "error_pct": percent_error,
            "measured_throughput": measured_throughput,
            "accuracy": accuracy,
            "service_times": service_times,
            "inter_arrivals": inter_arrivals,
        }

    return metrics


def print_table(metrics):
    print("\n" + "=" * 120)
    print(f"{'API':<8} {'λ (req/s)':<12} {'μ (req/s)':<12} {'ρ':<10} "
          f"{'W_pred (s)':<12} {'W_meas (s)':<12} {'W_ci (s)':<18} {'%err':<8} "
          f"{'X_meas (r/s)':<14}")
    print("-" * 120)

    for (method, lam), m in sorted(metrics.items()):
        if m["rho"] is None:
            rho_str = ">1 "
            W_pred_str = "N/A"
        else:
            rho_str = f"{m['rho']:.3f}"
            W_pred_str = f"{m['W_pred']:.4f}" if m['W_pred'] else "N/A"

        ci = m["W_ci"]
        ci_str = f"[{ci[0]:.3f}, {ci[1]:.3f}]" if ci[0] is not None else "N/A"
        err_str = f"{m['error_pct']:.1f}%" if m["error_pct"] != float("inf") else "N/A"

        print(f"{method:<8} {lam:<12.2f} {m['mu']:<12.4f} {rho_str:<10} "
              f"{W_pred_str:<12} {m['W_meas']:<12.4f} {ci_str:<18} {err_str:<8} "
              f"{m['measured_throughput']:<14.4f}")

    print("=" * 120)


def plot_l_vs_rho(metrics):
    methods = sorted(set(k[0] for k in metrics))
    fig, axes = plt.subplots(1, 3, figsize=(16, 5))

    for idx, method in enumerate(methods):
        ax = axes[idx]
        pts = [(m["rho"], m["L_pred"], m["mu"], lam)
               for (mth, lam), m in sorted(metrics.items())
               if mth == method and m["rho"] is not None]
        if not pts:
            ax.set_title(f"{method} — no data")
            continue

        rhos = [p[0] for p in pts]
        mu_val = pts[0][2]
        lambdas = [p[3] for p in pts]

        l_meas = []
        for (mth, lam), m in sorted(metrics.items()):
            if mth == method and m["rho"] is not None:
                l_meas.append(lam * m["W_meas"])

        rho_curve = np.linspace(0.01, 0.99, 200)
        l_curve = [r / (1 - r) for r in rho_curve]
        ax.plot(rho_curve, l_curve, "b-", linewidth=2,
                label=f"M/M/1 L (μ={mu_val:.2f})")

        ax.scatter(rhos, l_meas, color="red", s=60, zorder=5, label="Measured L (Little)")
        ax.axvline(x=1.0, color="gray", linestyle="--", alpha=0.4, label="ρ=1")

        ax.set_xlabel("Utilization ρ")
        ax.set_ylabel("Mean tasks in system L")
        ax.set_title(f"{method.upper()}")
        ax.legend()
        ax.grid(True, alpha=0.3)

    fig.suptitle("Queue Buildup: M/M/1 Predicted vs Measured Tasks in System")
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "l_vs_rho.png", dpi=150)
    print(f"  Saved {OUTPUT_DIR / 'l_vs_rho.png'}")


def plot_service_dist(metrics):
    methods = sorted(set(k[0] for k in metrics))
    fig, axes = plt.subplots(1, 3, figsize=(16, 5))

    for idx, method in enumerate(methods):
        ax = axes[idx]
        # Pick a mid-range lambda for this method
        lambdas = sorted([l for (mth, l) in metrics if mth == method])
        if not lambdas:
            continue
        mid_lam = lambdas[len(lambdas) // 2]
        m = metrics[(method, mid_lam)]
        times = m["service_times"]

        ax.hist(times, bins=12, density=True, alpha=0.6, color="steelblue", label="Observed")

        # Exponential fit
        mu_val = m["mu"]
        x = np.linspace(0, max(times) * 1.1, 200)
        y = mu_val * np.exp(-mu_val * x)
        # ax.plot(x, y, "r-", linewidth=2, label=f"Exp(μ={mu_val:.2f})")

        ax.set_xlabel("Service time (s)")
        ax.set_ylabel("Density")
        ax.set_title(f"{method.upper()} (λ={mid_lam})")
        ax.legend()
        ax.grid(True, alpha=0.3)

    fig.suptitle("Service Time Distribution")
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "service_dist.png", dpi=150)
    print(f"  Saved {OUTPUT_DIR / 'service_dist.png'}")


def plot_interarrival_qq(metrics):
    methods = sorted(set(k[0] for k in metrics))
    fig, axes = plt.subplots(1, 3, figsize=(16, 5))

    for idx, method in enumerate(methods):
        ax = axes[idx]
        lambdas = sorted([l for (mth, l) in metrics if mth == method])
        if not lambdas:
            continue
        mid_lam = lambdas[len(lambdas) // 2]
        m = metrics[(method, mid_lam)]
        ia = sorted(m["inter_arrivals"])

        # Theoretical exponential quantiles
        n = len(ia)
        theoretical = [-math.log(1 - (i + 0.5) / n) / mid_lam for i in range(n)]

        ax.scatter(theoretical, ia, alpha=0.5, s=10)
        max_val = max(max(theoretical), max(ia))
        ax.plot([0, max_val], [0, max_val], "r--", label="y=x (perfect match)")

        ax.set_xlabel("Theoretical Exp(λ) quantiles")
        ax.set_ylabel("Observed inter-arrival quantiles")
        ax.set_title(f"{method.upper()} (λ={mid_lam})")
        ax.legend()
        ax.grid(True, alpha=0.3)

    fig.suptitle("Inter-arrival Time Q-Q Plot: Poisson Assumption Check")
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "interarrival_qq.png", dpi=150)
    print(f"  Saved {OUTPUT_DIR / 'interarrival_qq.png'}")


def plot_throughput(metrics):
    methods = sorted(set(k[0] for k in metrics))
    fig, axes = plt.subplots(1, 3, figsize=(16, 5))

    for idx, method in enumerate(methods):
        ax = axes[idx]
        pts = [(lam, m["mu"], m["measured_throughput"]) for (mth, lam), m in sorted(metrics.items())
               if mth == method]
        if not pts:
            ax.set_title(f"{method} — no data")
            continue

        lambdas = [p[0] for p in pts]
        mus = [p[1] for p in pts]
        x_meas = [p[2] for p in pts]

        ideal = np.linspace(0, max(lambdas) * 1.2, 200)
        ax.plot(ideal, ideal, "g--", alpha=0.5, label="Ideal (X = λ)")

        mu_median = statistics.median(mus)
        ax.axhline(y=mu_median, color="orange", linestyle=":", alpha=0.7,
                   label=f"Saturation (μ≈{mu_median:.2f})")

        ax.scatter(lambdas, x_meas, color="red", s=60, zorder=5, label="Measured")
        ax.plot(lambdas, x_meas, "r-", alpha=0.3)

        ax.set_xlabel("Offered load λ (req/s)")
        ax.set_ylabel("Throughput X (req/s)")
        ax.set_title(f"{method.upper()} (μ≈{mu_median:.2f})")
        ax.legend()
        ax.grid(True, alpha=0.3)

    fig.suptitle("Throughput vs Offered Load")
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "throughput.png", dpi=150)
    print(f"  Saved {OUTPUT_DIR / 'throughput.png'}")

def plot_accuracy_vs_latency(metrics):
    methods = ["rule", "embed", "llm"]
    colors = {"rule": "#2ecc71", "embed": "#3498db", "llm": "#e74c3c"}
    markers = {"rule": "o", "embed": "s", "llm": "^"}

    fig, ax = plt.subplots(figsize=(10, 6))

    for method in methods:
        pts = [(m["W_meas"], m["accuracy"]) for (mth, _), m in sorted(metrics.items())
               if mth == method and m["accuracy"] is not None]
        if not pts:
            continue
        pts.sort(key=lambda x: x[0])
        latencies = [p[0] for p in pts]
        accuracies = [p[1] for p in pts]
        lambdas = [lam for (mth, lam), m in sorted(metrics.items())
                   if mth == method and m["accuracy"] is not None]

        ax.scatter(latencies, accuracies, color=colors[method], marker=markers[method],
                   s=100, zorder=5, label=method.upper())
        for l, a, lam in zip(latencies, accuracies, lambdas):
            ax.annotate(f"λ={lam}", (l, a), textcoords="offset points",
                        xytext=(5, 5), fontsize=8, alpha=0.7)

    ax.set_xlabel("Mean latency (s)")
    ax.set_ylabel("Accuracy")
    ax.set_title("Accuracy vs Average Latency by Technique")
    ax.legend()
    ax.grid(True, alpha=0.3)
    ax.set_xscale("log")
    ax.set_xlim(left=None)

    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "accuracy_vs_latency.png", dpi=150)
    print(f"  Saved {OUTPUT_DIR / 'accuracy_vs_latency.png'}")


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Loading rate experiment results...")
    data = load_results()
    print(f"  Found {len(data)} (method, λ) combinations")
    for (method, lam), rows in sorted(data.items()):
        print(f"    {method:8s}  λ={lam:6.2f}  n={len(rows)}")

    print("\nComputing M/M/1 metrics...")
    metrics = compute_metrics(data)

    print_table(metrics)

    print("\nGenerating plots...")
    plot_l_vs_rho(metrics)
    plot_service_dist(metrics)
    plot_interarrival_qq(metrics)
    plot_throughput(metrics)
    plot_accuracy_vs_latency(metrics)
    print("\nDone. All outputs in", OUTPUT_DIR)


if __name__ == "__main__":
    main()
