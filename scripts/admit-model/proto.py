"""
Kaplan 360++ 录取概率原型 v0（小容量演示，不改项目代码）

P(录取 | 学生, 项目) = c_j × sigmoid((g_eq − θ_j) / s_j)
  g_eq  : 学生 GPA（4 分制）+ 档位加成 shift（换成"C 档等价 GPA"）
  θ_j   : 项目门槛 = 同项目录取者（换成 C 档等价后）的 p25
  s_j   : 曲线陡度 = 录取者 IQR / 2.2，限制在 0.06–0.18
  c_j   : 天花板（条件很好时的录取率）：授课型 ~Beta(8,2)；精英型由申请/名额比推
私立生 shift = 颁发大学档位加成 + δ，δ 先验按项目簇设定，再用 Kaplan 真实录取案例更新。
所有不确定量做蒙特卡洛，输出中位数和 80% 区间。
"""
import json, math, random, statistics as st

B = "/mnt/user-data/uploads/kaplan_360++v201/"
AC = json.load(open(B + "data/raw/admit-cases.json"))["programmes"]
EV = json.load(open(B + "data/raw/admission-evidence.json"))["programmes"]
XDF = json.load(open(B + "data/pipeline/xdf/cases.json"))["cases"]
random.seed(7)
N = 4000

# ① 档位加成（C 档等价）：同项目录取者中位数 A 比 C 低 0.21、B 比 C 低 0.10（84 / 156 个项目）
SHIFT = {"A": 0.21, "B": 0.10, "C": 0.0}
UCD_AWARDER = "A"  # UCD QS 2027 = 100

# ② 私立 δ 先验（相对颁发大学档位）
PRIOR = {
    "taught": {"mu": -0.11, "sd": 0.08},  # 降一档：UCD → 约 B
    "elite": {"mu": -0.30, "sd": 0.10},   # 降到 C 以下
}
ELITE_PEI_MULT = (1.5, 8.5)  # 精英项目对私立生天花板再打折，Beta 均值 0.15（无案例的先验）


def ucd_to_four(g):
    """UCD 4.2 → 4 分制：先按 UCD 官方表定等级，再按英制分段线性映射（与项目 notes 相同）。"""
    for (a, b), (c, d) in [((3.68, 4.2), (3.7, 4.0)), ((3.08, 3.67), (3.3, 3.66)),
                           ((2.48, 3.07), (2.7, 3.24)), ((2.0, 2.47), (2.0, 2.63))]:
        if a <= g <= b + 0.005:
            return c + (min(g, b) - a) / (b - a) * (d - c)
    return 2.0


def curve(pid):
    """项目的 C 档等价录取分布 → θ、s、样本量、簇、天花板参数。"""
    v = AC[pid]
    bands = [g for g in v["gpaByTier"] if g["n"] >= 5]
    if bands:
        w = sum(g["n"] for g in bands)
        p25 = sum((g["p25"] + SHIFT[g["tier"]]) * g["n"] for g in bands) / w
        med = sum((g["median"] + SHIFT[g["tier"]]) * g["n"] for g in bands) / w
        p75 = sum((g["p75"] + SHIFT[g["tier"]]) * g["n"] for g in bands) / w
        n = w
    else:  # 没有分档：用整体分布 + 按生源构成加权的平均加成（构成未知时按 A）
        mix = v["mix"]; tot = sum(mix.values())
        sh = sum(SHIFT[t] * c for t, c in mix.items()) / tot if tot else SHIFT["A"]
        p25, med, p75 = (v["gpa"][k] + sh for k in ("p25", "median", "p75"))
        n = v["gpa"]["n"]
    iqr = max(p75 - p25, 0.08)
    stats = (EV.get(pid) or {}).get("stats")
    ratio = stats["applications"] / stats["places"] if stats and stats["places"] else None
    cluster = "elite" if ratio and ratio >= 8 else "taught"
    if cluster == "elite":
        offer_rate = min(0.95, (1 / ratio) / 0.65)  # 名额/申请 ÷ 接受率 0.65 ≈ 发 offer 率
        c_mean = min(0.9, 3 * offer_rate)            # 条件好的申请者约为平均的 3 倍
    else:
        c_mean = 0.8
    return dict(pid=pid, theta=p25, med=med, iqr=iqr, s=min(max(iqr / 2.2, 0.06), 0.18),
                n=n, cluster=cluster, ratio=ratio, c_mean=c_mean)


def beta_from_mean(m, k=10):
    return m * k, (1 - m) * k


def pct(x):
    return "<1%" if x < 0.01 else f"{x*100:.0f}%"


def fmt(m, lo, hi):
    return f"{pct(m):>4s} [{pct(lo)}–{pct(hi)}]"


def sig(x):
    return 1 / (1 + math.exp(-x))


# ③ 用新东方 Kaplan-UCD 录取案例更新"授课型"簇的 δ
def update_delta():
    obs = []
    for c in XDF:
        if not c["degree"].startswith("ucd-") or c.get("gpa") is None:
            continue
        g4 = ucd_to_four(c["gpa"])
        for a in c["applications"]:
            pid = a.get("programmeId")
            if a.get("result") != "admit" or pid not in AC:
                continue
            cv = curve(pid)
            if cv["cluster"] != "taught":
                continue
            implied = cv["med"] - g4 - SHIFT[UCD_AWARDER]  # 把他放到 C 等价中位数所需的 δ
            implied = max(-0.35, min(0.35, implied))        # 截尾：澳洲"过线即录"项目的低分录取不该主导
            var = (cv["iqr"] / 1.35) ** 2 + 0.05 ** 2      # 录取者分布宽度 + 额外噪声
            obs.append((implied, var, pid, round(g4, 2)))
    p = PRIOR["taught"]
    prec = 1 / p["sd"] ** 2 + sum(1 / v for _, v, _, _ in obs)
    mu = (p["mu"] / p["sd"] ** 2 + sum(x / v for x, v, _, _ in obs)) / prec
    return {"mu": mu, "sd": prec ** -0.5}, obs


def prob(g4, awarder, cv, delta, private=True, draws=N):
    out = []
    a, b = beta_from_mean(cv["c_mean"], 10)
    th_sd = cv["iqr"] / 1.35 / math.sqrt(cv["n"]) * 1.25
    for _ in range(draws):
        if private:
            d = random.gauss(delta[cv["cluster"]]["mu"], delta[cv["cluster"]]["sd"])
            lo = -0.1 if cv["cluster"] == "elite" else 0.0
            sh = min(max(SHIFT[awarder] + d, lo), SHIFT[awarder])
        else:
            sh = SHIFT[awarder]
        th = random.gauss(cv["theta"], th_sd)
        c = random.betavariate(a, b)
        if private and cv["cluster"] == "elite":
            c *= random.betavariate(*ELITE_PEI_MULT)
        out.append(c * sig((g4 + sh - th) / cv["s"]))
    out.sort()
    return out[len(out) // 2], out[len(out) // 10], out[len(out) * 9 // 10]


DEMO = [
    ("港大 Master of Global Management", "university-of-hong-kong-master-of-global-management"),
    ("港城大 MSc Business & Data Analytics", "city-university-of-hong-kong-msc-business-and-data-analytics"),
    ("NUS MSc Strategic Analysis & Innovation", "national-university-of-singapore-msc-in-strategic-analysis-and-innovation-msi"),
    ("NUS MSc Digital FinTech", "national-university-of-singapore-master-of-science-in-digital-financial-technology-msc-dfintech"),
    ("NTU MSc Financial Technology", "nanyang-technological-university-singapore-master-of-science-in-financial-technology"),
    ("爱丁堡 MSc Finance, Tech & Policy", "university-of-edinburgh-finance-technology-and-policy-msc"),
    ("曼大 MSc Management & IS", "university-of-manchester-msc-management-and-information-systems-change-and-development"),
    ("LSE MSc Finance and Risk", "london-school-of-economics-and-political-science-msc-finance-and-risk"),
    ("牛津 MSc Social Data Science", "university-of-oxford-msc-in-social-data-science"),
]
STUDENTS = [("2:2 · 2.90", 2.90), ("2:1 · 3.30", 3.30), ("高 2:1 · 3.55", 3.55), ("First · 3.80", 3.80)]

if __name__ == "__main__":
    post, obs = update_delta()
    delta = {"taught": post, "elite": PRIOR["elite"]}
    print(f"δ 授课型 先验 {PRIOR['taught']['mu']:+.2f}±{PRIOR['taught']['sd']:.2f} → 后验 {post['mu']:+.2f}±{post['sd']:.2f}"
          f"（{len(obs)} 条 Kaplan-UCD 录取）; Kaplan-UCD 有效加成 ≈ {SHIFT['A'] + post['mu']:.2f}（A=0.21 B=0.10 C=0）")
    for x in obs:
        print("   obs", x[2][:60], "g4", x[3], "implied δ", round(x[0], 2))
    print()
    rows = []
    for name, pid in DEMO:
        cv = curve(pid)
        cells = [prob(ucd_to_four(g), UCD_AWARDER, cv, delta) for _, g in STUDENTS]
        rows.append((name, cv, cells))
        tag = f"精英(申请/名额 {cv['ratio']:.0f})" if cv["cluster"] == "elite" else "授课型"
        print(f"{name:38s} {tag:16s} n={cv['n']:3d} θ={cv['theta']:.2f} | " +
              " | ".join(fmt(m, lo, hi) for m, lo, hi in cells))
    json.dump({"delta": delta, "obs": obs, "students": STUDENTS,
               "rows": [(n, {k: v for k, v in cv.items()}, cells) for n, cv, cells in rows]},
              open("proto_out.json", "w"), ensure_ascii=False)

    # ④ 回测：18 位 Kaplan 学生的真实 offer，在三种规则下模型给多少
    print("\n回测（全是录取，只能看'有没有被低估'）")
    rules = {"按 C（现行）": {"taught": {"mu": -0.21, "sd": 0.001}, "elite": {"mu": -0.21, "sd": 0.001}},
             "本原型后验": delta,
             "按颁发大学 A": {"taught": {"mu": 0, "sd": 0.001}, "elite": {"mu": 0, "sd": 0.001}}}
    res = {k: [] for k in rules}
    for c in XDF:
        if not c["degree"].startswith("ucd-") or c.get("gpa") is None:
            continue
        for a in c["applications"]:
            pid = a.get("programmeId")
            if pid in AC:
                cv = curve(pid)
                for k, d in rules.items():
                    res[k].append(prob(ucd_to_four(c["gpa"]), "A", cv, d, draws=800)[0])
    for k, v in res.items():
        print(f"  {k:12s} 平均 {st.mean(v)*100:.0f}%  低于 30% 的 offer：{sum(x < 0.3 for x in v)}/{len(v)}")
