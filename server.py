"""FinCrew backend: simulated business, health score, events, what-if, chat, audit trail."""
import os, re, json, time, urllib.request
from flask import Flask, jsonify, request, send_from_directory
from werkzeug.exceptions import HTTPException
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

BASE = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, static_folder=None)
BASE_RUNWAY = 480000 / 420000
EV = ["late", "expense", "suspicious", "deadline", "order"]
DEFAULT_BUSINESS_PROFILE = {
    "name": "AriaCraft Supplies",
    "type": "Retail",
    "customType": "",
    "sells": "Craft and hobby materials",
    "revenue": 680000,
    "expenses": 420000,
    "employees": 8,
    "payment": "Mostly card and bank transfer",
    "majorExpenses": "Inventory, rent, staffing, packaging",
    "cash": 480000,
    "receivables": 135000,
    "payables": 95000,
    "obligations": 95000,
    "risk": "Medium",
    "opportunities": "Buy in bulk, improve cash collection, upsell repeat customers"
}
BUSINESS_TYPE_RULES = {
    "Retail": {
        "focus": ["inventory turns", "sales velocity", "supplier payments", "customer credit", "cash flow"],
        "risk": "Slow stock movement or customer payment delays can drain working capital quickly.",
        "step": "Tighten inventory buying and chase the overdue customer payment."
    },
    "Restaurant": {
        "focus": ["food and material costs", "wastage", "staffing", "supplier payments", "daily sales"],
        "risk": "Food costs and wasted stock can squeeze cash even when sales look healthy.",
        "step": "Cut waste, protect daily cash, and keep supplier exposure under control."
    },
    "Café": {
        "focus": ["food and beverage costs", "staff costs", "daily cash", "supplier terms", "wastage"],
        "risk": "A quiet day plus high payroll can leave the shop short of cash before the week ends.",
        "step": "Protect the next 7 days of payroll, reduce waste, and keep an eye on ingredient buys."
    },
    "Clothing": {
        "focus": ["inventory levels", "seasonal sales", "slow-moving stock", "supplier terms", "cash flow"],
        "risk": "Unsold stock ties up cash and raises markdown risk.",
        "step": "Review slow stock, trim expensive buys, and collect overdue invoices quickly."
    },
    "Salon": {
        "focus": ["bookings", "staff utilization", "supply costs", "customer payments", "appointment cash flow"],
        "risk": "Empty appointments and late customer payments can damage the cash buffer.",
        "step": "Focus on booked revenue, lower discretionary spend, and collect outstanding customer balances."
    },
    "Freelancer": {
        "focus": ["client invoices", "overdue payments", "project profitability", "tax reserve", "cash runway"],
        "risk": "Late-paying clients can quickly turn strong monthly revenue into a cash squeeze.",
        "step": "Collect overdue invoices, keep a tax reserve, and delay non-essential spend."
    },
    "Service": {
        "focus": ["customer payments", "staff costs", "recurring revenue", "operating expenses", "outstanding invoices"],
        "risk": "Late payment and staff costs can erode profit before the month closes.",
        "step": "Follow up on unpaid work, protect payroll, and keep only the most valuable costs running."
    },
    "E-commerce": {
        "focus": ["orders", "returns", "inventory", "shipping", "platform fees", "customer payments"],
        "risk": "Returns, shipping and payment delays can eat the margin before the order is even paid.",
        "step": "Review return risk, ship profitably, and avoid inventory purchases that lock too much cash."
    },
    "Wholesale": {
        "focus": ["supplier terms", "inventory turn", "cash conversion", "order margins", "customer collections"],
        "risk": "Buying stock before customers pay can lead to a working-capital squeeze.",
        "step": "Stagger purchases, prioritize higher-margin orders, and stop slow-paying accounts from growing."
    },
    "Manufacturing": {
        "focus": ["raw materials", "production cost", "inventory", "supplier payments", "payroll", "order profitability"],
        "risk": "Material waste and slow customer payments can quickly pressure working capital.",
        "step": "Protect raw-material cash, delay non-core buys, and check which orders actually improve cash."
    },
    "Agency": {
        "focus": ["client invoices", "project margins", "recurring revenue", "payroll", "tax reserve"],
        "risk": "A strong headline pipeline is not enough if cash is tied up in unpaid work.",
        "step": "Push for faster collections and only take on work that keeps enough cash available."
    },
    "Startup": {
        "focus": ["cash runway", "sales conversion", "burn rate", "customer acquisition", "capital planning"],
        "risk": "The business can still be growing while losing cash if spending outruns revenue.",
        "step": "Focus on runway, delay non-essential spend, and commit only to growth that remains affordable."
    },
    "Other": {
        "focus": ["cash stability", "core operating costs", "customer payments", "growth readiness", "owner judgement"],
        "risk": "This business needs a clear operating rhythm because the risk profile is not tied to a single model.",
        "step": "Track cash, customer collection, and the recurring cost base before making large commitments."
    },
    "Custom business": {
        "focus": ["cash stability", "core operating costs", "customer payments", "growth readiness", "owner judgement"],
        "risk": "This business needs a clear operating rhythm because the risk profile is not tied to a single model.",
        "step": "Track cash, customer collection, and the recurring cost base before making large commitments."
    }
}
BUSINESS_PROFILE = dict(DEFAULT_BUSINESS_PROFILE)


def inr(n):
    n = int(round(n)); s = str(abs(n))
    if len(s) > 3:
        h, t = s[:-3], s[-3:]; parts = []
        while len(h) > 2:
            parts.insert(0, h[-2:]); h = h[:-2]
        if h: parts.insert(0, h)
        s = ",".join(parts + [t])
    return ("-" if n < 0 else "") + "₹" + s


def fresh():
    return {"cash": 480000, "revenue": 680000, "expenses": 420000, "employees": 8, "receivables": 135000,
            "obligations": 95000, "overdue": 0, "reminded": False, "flag": "none", "deadline": "none",
            "order": "none", "extra": 0, "started": False, "current": None, "done": [], "audit": [],
            "reason": "Everything looks steady. No events yet.", "abc": "Not yet due", "one_offs": []}


S = fresh()
GLOSS = {
    "cash": "Cash is the money in your bank account right now, the money you can spend today.",
    "revenue": "Revenue is the total money customers pay you in a month, before any costs.",
    "expenses": "Expenses are everything you pay out each month: salaries, materials, rent and so on.",
    "runway": "Runway is how many days you could keep paying your bills with the cash you have, if no new money came in.",
    "receivables": "This is money customers owe you for work already done. It isn't in your bank yet.",
    "obligations": "These are bills and dues you must pay soon, like taxes.",
    "risk": "Risk level tells you how worried to be. Low means relax, High means act soon.",
}


def log(msg, kind="info"):
    S["audit"].append({"t": time.strftime("%I:%M:%S %p").lstrip("0"), "msg": msg, "kind": kind})


def breakdown(s=None):
    s = s or S; b = []
    rp = max(0, round((BASE_RUNWAY - s["cash"] / (s["expenses"] + s["extra"])) * 21))
    if rp: b.append(("Your cash would last fewer days than usual", -rp))
    if s["overdue"]:
        op = round(s["overdue"] / 85000 * 8) - (2 if s["reminded"] else 0)
        b.append((inr(s["overdue"]) + " in customer payments is overdue" + (" (reminder prepared)" if s["reminded"] else ""), -op))
    if s["flag"] == "pending": b.append(("An unusual transaction has not been reviewed", -3))
    elif s["flag"] == "reviewing": b.append(("An unusual transaction is still under review", -2))
    if s["deadline"] == "pending": b.append(("A ₹95,000 deadline is not prepared yet", -2))
    return b


def score(s=None):
    return max(0, min(100, 82 + sum(p for _, p in breakdown(s))))


def level(sc):
    return ("HEALTHY", "green") if sc >= 75 else ("NEEDS ATTENTION", "amber") if sc >= 55 else ("AT RISK", "red")


def runway(s=None):
    s = s or S
    return round(s["cash"] / (s["expenses"] + s["extra"]) * 30)


def risk_of(days):
    return "Low" if days >= 40 else "Medium" if days >= 20 else "High"


def metrics():
    exp = S["expenses"] + S["extra"]
    return {"cash": S["cash"], "revenue": S["revenue"], "expenses": exp, "runway_days": runway(),
            "receivables": S["receivables"], "obligations": S["obligations"], "employees": S["employees"],
            "profit": S["revenue"] - exp, "risk": risk_of(runway())}


def business_type():
    profile = BUSINESS_PROFILE.get("type", "Retail")
    if profile == "Other" and BUSINESS_PROFILE.get("customType"):
        return BUSINESS_PROFILE["customType"]
    return profile


def business_rules():
    key = business_type()
    return BUSINESS_TYPE_RULES.get(key, BUSINESS_TYPE_RULES["Retail"])


def priorities():
    rules = business_rules()
    p = []
    if S["overdue"]:
        p.append({"tone": "red", "icon": "🔴", "text": inr(S["overdue"]) + " customer payment is overdue" + (" (reminder prepared)" if S["reminded"] else ""), "go": "invoices"})
    if S["flag"] in ("pending", "reviewing"):
        p.append({"tone": "amber", "icon": "🟠", "text": "₹48,500 unusual transaction needs review", "go": "risks"})
    if S["deadline"] == "pending":
        p.append({"tone": "yellow", "icon": "🟡", "text": "Financial deadline approaching in 5 days", "go": "obligations"})
    if S["order"] == "pending":
        p.append({"tone": "green", "icon": "🟢", "text": "₹3,00,000 growth opportunity available", "go": "opportunities"})
    if not p:
        p.append({"tone": "green", "icon": "🟢", "text": "Nothing urgent. FinCrew is watching your numbers. "+ rules["step"], "go": "simulation"})
    if rules.get("focus"):
        p.insert(0, {"tone": "green", "icon": "✦", "text": "Focus area: " + rules["focus"][0], "go": "overview"})
    return p[:4]


def risks():
    rules = business_rules()
    r = []
    if S["overdue"]: r.append(("red", "Late customer payment", "ABC Industries owes ₹85,000, now 12 days overdue."))
    if S["flag"] in ("pending", "reviewing"): r.append(("amber", "Unusual transaction", "₹48,500 to a new destination needs your review."))
    d = runway()
    r.append(("amber" if d < 45 else "green", "Cash cushion", "Your cash covers about %d days of running costs. Aim for 45 or more." % d))
    if BUSINESS_PROFILE.get("type") == "Freelancer":
        r.append(("amber", "Client concentration", "A small number of clients can create a cash gap if invoices move late."))
    else:
        r.append(("amber", "Depending on one customer", "ABC Industries is 63% of what customers owe you."))
    if S["deadline"] == "pending": r.append(("amber", "Upcoming deadline", "₹95,000 is due in 5 days and isn't set aside yet."))
    r.append(("green" if "cash" in " ".join([item[1] for item in r]).lower() else "amber", "Business focus", rules["risk"]))
    return [{"tone": a, "title": b, "detail": c} for a, b, c in r]

def order_calc():
    rev, cost = 300000, 195000
    return [["Revenue", inr(rev)], ["Expected costs", inr(cost)], ["Cash needed up front", inr(cost)],
            ["Existing obligations", inr(S["obligations"])], ["Expected profit", inr(rev - cost)],
            ["Cash left after order and obligations", inr(S["cash"] - cost - S["obligations"])]]


def A(i, label, tone, ap=None):
    return {"id": i, "label": label, "tone": tone, "approval": ap}


def build_event(eid):
    if eid == "late":
        return {"id": eid, "icon": "⚠️", "title": "PAYMENT DELAYED", "tone": "red",
                "what": "ABC Industries has not paid invoice INV-1042 for ₹85,000. It is 12 days overdue.",
                "matters": "One of your customers is taking longer than usual to pay. That means you currently have less cash available than you planned for.",
                "impact": "₹85,000 is stuck. That's 63% of everything your customers owe you.",
                "urgency": "High. The longer it waits, the harder it is to collect.",
                "recommendation": "Send a polite payment reminder to ABC Industries.",
                "actions": [A("approve", "APPROVE", "primary", {"action": "Send payment reminder", "customer": "ABC Industries", "amount": "₹85,000", "reason": "Invoice overdue by 12 days"}), A("cancel", "CANCEL", "ghost")],
                "why": ["The invoice is 12 days past its due date and nothing has been received.", "₹85,000 is about 18% of your monthly revenue, enough to matter.", "A friendly reminder is low-cost and keeps the relationship intact.", "FinCrew only prepares the reminder. You stay in control of sending it."]}
    if eid == "expense":
        return {"id": eid, "icon": "💸", "title": "LARGE EXPENSE", "tone": "amber",
                "what": "An unexpected equipment repair bill of ₹1,20,000 was paid from your account.",
                "matters": "That is more than a quarter of your normal monthly spending, and it wasn't planned.",
                "impact": "Your cash and the number of days it can cover your bills both dropped (see below).",
                "urgency": "Medium. You are still safe, but the cushion is thinner.",
                "recommendation": "Pause optional spending for 30 days (about ₹25,000 saved per month) to rebuild your cushion.",
                "actions": [A("approve", "APPROVE", "primary", {"action": "Pause optional spending for 30 days", "customer": "AriaCraft Supplies (internal)", "amount": "₹25,000 / month saved", "reason": "Rebuild cash cushion after the ₹1,20,000 repair"}), A("cancel", "CANCEL", "ghost")],
                "why": ["The repair cost ₹1,20,000, about 25% of your cash.", "Your cash now covers fewer days of expenses than before.", "Trimming optional spending is the safest fix: it doesn't hurt customers or staff.", "You can undo the pause whenever you want."]}
    if eid == "suspicious":
        rv = S["flag"] == "reviewing"
        acts = [A("hold", "HOLD", "warn", {"action": "Hold the transaction", "customer": "New destination account", "amount": "₹48,500", "reason": "Unusual transaction: hold until you've checked it"}),
                A("approve", "APPROVE", "primary", {"action": "Approve the transaction", "customer": "New destination account", "amount": "₹48,500", "reason": "You confirm this payment is expected"})]
        if not rv: acts.insert(0, A("review", "REVIEW", "ghost", {"action": "Mark for review", "customer": "New destination account", "amount": "₹48,500", "reason": "Keep it open while you check the details"}))
        return {"id": eid, "icon": "🔍", "title": "UNUSUAL TRANSACTION", "tone": "amber",
                "what": "A ₹48,500 transfer to a destination you have never paid before is waiting.",
                "matters": "This transaction appears unusual and should be reviewed. It may be perfectly fine, so FinCrew just wants you to confirm.",
                "impact": "If it goes through, your cash drops by ₹48,500.",
                "urgency": "Medium. Review before the money moves.",
                "recommendation": "Review it now. If you don't recognise it, hold it.",
                "list": ["New destination", "Unusual amount", "Different from normal behaviour", "No previous similar transaction"],
                "list_title": "Why it looks unusual", "actions": acts,
                "why": ["The destination is new. You haven't paid it before.", "The amount is unusual compared to your normal payments.", "It differs from how your business normally behaves.", "No similar transaction has happened before.", "None of this proves anything is wrong. It just deserves a quick look."]}
    if eid == "deadline":
        return {"id": eid, "icon": "📅", "title": "DEADLINE APPROACHING", "tone": "yellow",
                "what": "A financial obligation of ₹95,000 is due in 5 days.",
                "matters": "Missing it can mean penalties and extra stress. The money needs to be ready.",
                "impact": "₹95,000 will leave your account in 5 days.",
                "urgency": "Medium. Five days is enough, if you prepare now.",
                "recommendation": "Set ₹95,000 aside now and gather the paperwork.",
                "list": ["Confirm the exact amount with your accountant", "Keep ₹95,000 aside in your bank account", "Collect this month's sales and purchase records", "Pay or file at least one day before the due date"],
                "list_title": "What to prepare",
                "actions": [A("prepare", "SET ASIDE ₹95,000", "primary", {"action": "Set aside ₹95,000 for the deadline", "customer": "Statutory dues", "amount": "₹95,000", "reason": "Due in 5 days"}), A("cancel", "REMIND ME LATER", "ghost")],
                "why": ["The deadline is 5 days away.", "Your cash can cover it, but only if nothing else spends it first.", "Setting it aside early removes the risk of a last-minute scramble."]}
    return {"id": eid, "icon": "🚀", "title": "GROWTH OPPORTUNITY", "tone": "green",
            "what": "A new customer wants to place an order worth ₹3,00,000.",
            "matters": "This order can increase revenue, but accepting it immediately may reduce your cash buffer.",
            "impact": "You would spend ₹1,95,000 before the customer pays you.",
            "urgency": "Medium. The customer expects an answer soon.",
            "recommendation": "Ask for an advance payment. You keep the growth and protect your cash.",
            "list": [x[0] + ": " + x[1] for x in order_calc()], "list_title": "FinCrew's numbers",
            "actions": [A("accept", "ACCEPT", "ghost", {"action": "Accept the ₹3,00,000 order as is", "customer": "New customer", "amount": "₹1,95,000 cost up front", "reason": "Grow revenue"}),
                        A("advance", "REQUEST ADVANCE", "primary", {"action": "Request a 50% advance and accept", "customer": "New customer", "amount": "₹1,50,000 advance", "reason": "Protect your cash while growing"}),
                        A("negotiate", "NEGOTIATE", "ghost", {"action": "Negotiate better payment terms", "customer": "New customer", "amount": "₹3,00,000 order", "reason": "Ask for shorter payment days"}),
                        A("delay", "DELAY", "ghost", {"action": "Ask the customer to wait", "customer": "New customer", "amount": "₹3,00,000 order", "reason": "Wait until cash is stronger"})],
            "why": ["The order brings ₹1,05,000 of expected profit.", "But you'd pay ₹1,95,000 in costs before getting paid.", "With your ₹95,000 obligation, accepting immediately leaves a thin cushion.", "An advance keeps the profit and cuts the cash risk."]}


def set_reason(before, why):
    after = score()
    S["reason"] = ("Financial Health %s from %d to %d because %s" % ("decreased" if after < before else "improved", before, after, why)) if after != before else why[0].upper() + why[1:]


def trigger(eid):
    b = {"cash": S["cash"], "days": runway(), "score": score()}
    why = ""
    if eid == "late":
        S["overdue"] = 85000; S["abc"] = "Overdue 12 days"; why = "₹85,000 in customer payments is overdue."
    elif eid == "expense":
        S["cash"] -= 120000; S["one_offs"].append("Equipment repair ₹1,20,000"); why = "a ₹1,20,000 expense reduced your cash and shortened your runway."
    elif eid == "suspicious":
        S["flag"] = "pending"; why = "an unusual ₹48,500 transaction is waiting for review."
    elif eid == "deadline":
        S["deadline"] = "pending"; why = "a ₹95,000 deadline is 5 days away and not prepared."
    else:
        S["order"] = "pending"; why = "a big order is waiting for your decision."
    ev = build_event(eid)
    a = {"cash": S["cash"], "days": runway(), "score": score()}
    ev["stats"] = []
    if a["cash"] != b["cash"]: ev["stats"].append(["Cash", inr(b["cash"]), inr(a["cash"])])
    if a["days"] != b["days"]: ev["stats"].append(["Cash runway", "%d days" % b["days"], "%d days" % a["days"]])
    if a["score"] != b["score"]: ev["stats"].append(["Financial Health", str(b["score"]), str(a["score"])])
    S["current"] = ev
    log("FinCrew detected: %s." % ev["title"].title(), "detect")
    log("FinCrew calculated the impact on cash, runway and health.", "calc")
    log("FinCrew recommended: %s" % ev["recommendation"], "ai")
    if a["score"] != b["score"]: set_reason(b["score"], why)
    else: S["reason"] = "FinCrew spotted something: " + why


@app.post("/api/act")
def act():
    d = request.get_json(silent=True) or {}
    ev, a = S["current"], d.get("action")
    if not ev or a not in [x["id"] for x in ev["actions"]]:
        return err("That action isn't available right now.")
    b, eid, resolved, res = score(), ev["id"], True, {}
    lab = next(x["label"] for x in ev["actions"] if x["id"] == a)
    if a == "cancel":
        out = "Cancelled by owner. No changes made."; log("Owner cancelled: %s." % ev["title"].title(), "owner")
        res = {"title": "Cancelled", "message": "Nothing was changed. FinCrew logged your decision."}
    else:
        log("Owner approved: %s." % ev["actions"][[x["id"] for x in ev["actions"]].index(a)]["approval"]["action"], "owner")
        if eid == "late":
            S["reminded"] = True; out = "Payment reminder prepared"
            res = {"title": "Reminder prepared", "message": "Your approved reminder is ready. FinCrew never sends anything on its own: copy it and send it when you're ready.",
                   "draft": "Hi ABC Industries team,\n\nA gentle reminder that invoice INV-1042 for ₹85,000 is now 12 days past its due date. Could you confirm when we can expect payment?\n\nThank you,\nAriaCraft Supplies"}
            log("Reminder prepared for ABC Industries.", "action")
        elif eid == "expense":
            S["extra"] -= 25000; out = "Optional spending paused"
            res = {"title": "Optional spending paused", "message": "Monthly spending is now ₹25,000 lower, so your cash lasts longer."}
            log("Optional spending paused for 30 days.", "action")
        elif eid == "suspicious":
            if a == "review":
                S["flag"] = "reviewing"; resolved = False; S["current"] = build_event(eid); out = ""
                res = {"title": "Marked for review", "message": "The transaction stays open. Decide to HOLD or APPROVE when you've checked it."}
                log("Transaction marked for review.", "action")
            elif a == "hold":
                S["flag"] = "held"; out = "Transaction held"
                res = {"title": "Transaction held", "message": "The ₹48,500 transfer is paused until you say otherwise."}
                log("₹48,500 transaction held.", "action")
            else:
                S["flag"] = "cleared"; S["cash"] -= 48500; out = "Transaction approved by owner"
                res = {"title": "Transaction approved", "message": "The ₹48,500 transfer was approved by you. Cash is lower by that amount."}
                log("₹48,500 transaction approved by owner.", "action")
        elif eid == "deadline":
            S["deadline"] = "prepared"; out = "₹95,000 set aside"
            res = {"title": "Money set aside", "message": "₹95,000 is marked for the deadline. Next: collect your records and pay a day early."}
            log("₹95,000 marked as set aside for the deadline.", "action")
        else:
            S["order"] = a
            if a == "accept": S["cash"] -= 195000; S["receivables"] += 300000; out = "Order accepted as is"; m = "Order accepted. Your cash dropped by ₹1,95,000 until the customer pays."
            elif a == "advance": S["cash"] += 150000 - 195000; S["receivables"] += 150000; out = "Order accepted with advance"; m = "Advance requested. Net cash impact is only ₹45,000 instead of ₹1,95,000."
            elif a == "negotiate": out = "Negotiating terms"; m = "FinCrew logged this. Aim for 50% advance or payment within 15 days."
            else: out = "Order delayed"; m = "The order is on hold. You keep your cash buffer; the customer may not wait."
            res = {"title": "Decision recorded", "message": m}; log(out + ".", "action")
    if resolved:
        S["done"].append({"id": eid, "title": ev["title"], "outcome": out}); S["current"] = None
    after = score()
    if after != b: set_reason(b, "of your decision: " + lab.lower())
    log("Decision recorded. Financial Health is now %d/100." % after, "record")
    res.update(before=b, after=after)
    return jsonify(state=state(), result=res)


@app.post("/api/note")
def note():
    log("Owner chose not to approve: %s. Nothing changed." % str((request.get_json(silent=True) or {}).get("action", "action"))[:80], "owner")
    return jsonify(state=state())


def snap(cash, extra, sc, profit):
    return {"cash": cash, "runway_days": round(cash / (S["expenses"] + extra) * 30), "profit": profit, "score": sc}


@app.post("/api/whatif")
def whatif():
    d = request.get_json(silent=True) or {}
    k = d.get("type")
    try: v = float(d.get("value") or 0)
    except (TypeError, ValueError): return err("Please enter a number.")
    if k not in ("spend", "late", "hire", "revenue", "order") or v < 0 or v > 1e9: return err("Please choose a scenario and enter a sensible number.")
    cash, extra, prof = S["cash"], S["extra"], S["revenue"] - S["expenses"] - S["extra"]
    cur = snap(cash, extra, score(), prof)
    exp = S["expenses"] + extra
    if k == "spend":
        s = dict(S, cash=cash - v); sc = score(s); sn = snap(cash - v, extra, sc, prof)
        title, res = "Spend %s today" % inr(v), "Cash falls to %s, enough for about %d days of bills." % (inr(cash - v), sn["runway_days"])
    elif k == "late":
        buf = cash - S["obligations"] - exp / 30 * v
        sc = max(0, score() - min(10, round(v / 30 * 6))); sn = snap(cash, extra, sc, prof); sn["runway_days"] = max(0, round(buf / exp * 30))
        title, res = "ABC Industries pays %d days late" % v, "After your ₹95,000 obligation and %d days of running costs, you'd have about %s left without that payment." % (v, inr(buf))
    elif k == "hire":
        s = dict(S, extra=extra + v); sc = score(s); sn = snap(cash, extra + v, sc, prof - v)
        title, res = "Hire someone at %s/month" % inr(v), "Monthly profit falls from %s to %s and your cash covers fewer days." % (inr(prof), inr(prof - v))
    elif k == "revenue":
        gain = S["revenue"] * v / 100; sc = min(100, score() + min(6, round(v / 5))); sn = snap(cash + gain, extra, sc, prof + gain)
        title, res = "Revenue rises %g%%" % v, "Monthly profit grows from %s to %s. After one month your cash would be %s." % (inr(prof), inr(prof + gain), inr(cash + gain))
    else:
        c = cash - 195000 - S["obligations"]; s = dict(S, cash=cash - 195000); sc = score(s); sn = snap(cash - 195000, extra, sc, prof + 105000)
        title, res = "Accept the ₹3,00,000 order now", "You'd pay ₹1,95,000 up front. After obligations you'd have %s left until the customer pays." % inr(c)
    r = risk_of(sn["runway_days"])
    rec = {"Low": "You can go ahead comfortably.", "Medium": "Possible, but protect your cash: stagger the spend or get a payment up front.",
           "High": "Hold off. This would leave your cash too thin. Raise cash or negotiate first."}[r]
    return jsonify(title=title, current=cur, scenario=sn, result=res, risk=r, recommendation=rec)


def parse_amount(t, default):
    m = re.search(r"(\d+(?:\.\d+)?)\s*(lakhs?|lacs?|l|k|thousand)?\b", t.replace(",", ""))
    if not m: return default
    n, u = float(m.group(1)), (m.group(2) or "")
    return n * (100000 if u.startswith(("l",)) and u != "" else 1000 if u in ("k", "thousand") else 1)


def local_answer(q, simple):
    t, m, sc = q.lower(), metrics(), score(); lv = level(sc)[0].lower()
    P = priorities(); rules = business_rules(); g = lambda k: ("\n\n**What does this mean?** " + GLOSS[k]) if simple else ""
    follow = ["What should I do today?", "What is my biggest risk?", "Why did my score fall?"]
    if any(w in t for w in ("afford", "spend")) or ("expense" in t and "?" in t and "what" not in t):
        amt = parse_amount(t, 120000); c = S["cash"] - amt; days = round(c / m["expenses"] * 30)
        txt = "If you spend %s, your cash drops to %s, enough for about %d days of bills. %s" % (inr(amt), inr(c), days, "That's comfortable." if days >= 40 else "That's possible but tight, so I'd stagger the payment." if days >= 20 else "I'd hold off. That leaves too little cushion.") + g("runway")
    elif "late" in t or "pays" in t:
        dm = re.search(r"(\d+)\s*days?", t); days = int(dm.group(1)) if dm else 15
        buf = S["cash"] - S["obligations"] - m["expenses"] / 30 * days
        txt = "If ABC Industries pays %d days late, you'd still have about %s after covering your ₹95,000 obligation and %d days of costs. %s" % (days, inr(buf), days, "You'd be fine, but keep chasing them." if buf > 100000 else "It gets tight, so I'd send a reminder now.") + g("receivables")
    elif "risk" in t:
        r = risks()[0]; txt = "Your biggest risk right now is: **%s**. %s" % (r["title"], r["detail"]) + g("risk")
    elif "today" in t or ("what" in t and "do" in t):
        txt = "Here's what matters most today:\n" + "\n".join("%s %s" % (p["icon"], p["text"]) for p in P[:4])
    elif "score" in t or "fall" in t or "drop" in t or "why" in t:
        txt = S["reason"] + "\n\n" + "\n".join("• %s (%d)" % (a, b) for a, b in breakdown()) if breakdown() else "Your score is steady at %d/100. Nothing is pulling it down." % sc
    elif "simple" in t or "explain" in t:
        txt = "In simple words: your business has %s in the bank, which can pay your bills for about %d days. Customers owe you %s. Your health score is %d out of 100, which is %s." % (inr(m["cash"]), m["runway_days"], inr(m["receivables"]), sc, lv)
    elif "hire" in t:
        sal = parse_amount(t, 35000); p = m["profit"] - sal
        txt = "Hiring at %s/month would cut your monthly profit from %s to %s. %s" % (inr(sal), inr(m["profit"]), inr(p), "You can afford it, but confirm revenue is steady first.")
    elif "order" in t or "accept" in t:
        txt = "The ₹3,00,000 order brings about ₹1,05,000 profit but costs ₹1,95,000 up front. Ask for a 50% advance so your cash stays safe."
    else:
        txt = "Your business is **%s** at %d/100. You have %s in cash (about %d days of bills), customers owe you %s, and you earn roughly %s a month after costs. %s" % (lv, sc, inr(m["cash"]), m["runway_days"], inr(m["receivables"]), inr(m["profit"]), "Top priority: " + P[0]["text"] + ".") + g("runway")
    if rules.get("focus"):
        txt += "\n\n**Business focus for %s:** %s" % (business_type(), ", ".join(rules["focus"][:3]))
    return {"text": txt, "source": "local", "followups": follow}


def ai_answer(q, simple):
    key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not key: return None
    ctx = json.dumps({"metrics": metrics(), "score": score(), "priorities": [p["text"] for p in priorities()], "reason": S["reason"]})
    sysm = "You are FinCrew, a calm financial teammate for a small business owner. Use ONLY this simulated data: %s. Be brief (under 120 words), plain-spoken, no jargon.%s" % (ctx, " Explain like to someone who has never studied finance." if simple else "")
    body = json.dumps({"model": os.getenv("FINCREW_MODEL", "claude-haiku-5-5"), "max_tokens": 400, "system": sysm, "messages": [{"role": "user", "content": q}]}).encode()
    try:
        req = urllib.request.Request("https://api.anthropic.com/v1/messages", body, {"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"})
        with urllib.request.urlopen(req, timeout=8) as r:
            return json.load(r)["content"][0]["text"]
    except Exception:
        return None


@app.post("/api/business-profile")
def update_business_profile():
    d = request.get_json(silent=True) or {}
    try:
        profile = {
            "name": str(d.get("name") or DEFAULT_BUSINESS_PROFILE["name"]),
            "type": str(d.get("type") or DEFAULT_BUSINESS_PROFILE["type"]),
            "customType": str(d.get("customType") or ""),
            "sells": str(d.get("sells") or ""),
            "revenue": float(d.get("revenue") or 0),
            "expenses": float(d.get("expenses") or 0),
            "employees": int(float(d.get("employees") or 0)),
            "payment": str(d.get("payment") or ""),
            "majorExpenses": str(d.get("majorExpenses") or "")
        }
    except (TypeError, ValueError):
        return err("Please enter valid business information.")
    BUSINESS_PROFILE.clear(); BUSINESS_PROFILE.update(profile)
    return jsonify({"ok": True, "business": profile, "state": state()})


@app.post("/api/chat")
def chat():
    d = request.get_json(silent=True) or {}
    q = str(d.get("message", "")).strip()[:500]
    if not q: return err("Type a question first.")
    simple = bool(d.get("simple"))
    out = local_answer(q, simple); txt = ai_answer(q, simple)
    if txt: out.update(text=txt, source="ai")
    return jsonify(out)


def state():
    sc = score(); lv, tone = level(sc)
    profile = BUSINESS_PROFILE
    inv = [{"id": "INV-1042", "customer": "ABC Industries", "amount": 85000, "status": S["abc"], "tone": "red" if S["overdue"] else "grey"},
           {"id": "INV-1047", "customer": "Sharma Traders", "amount": 32000, "status": "Due in 9 days", "tone": "grey"},
           {"id": "INV-1051", "customer": "Meera Interiors", "amount": 18000, "status": "Due in 20 days", "tone": "grey"}]
    opps = [{"title": "Offer a 2% early-payment discount", "detail": "Sharma Traders may pay ₹32,000 sooner. You'd give up about ₹640 to get cash earlier."}]
    if S["order"] == "pending": opps.insert(0, {"title": "₹3,00,000 new customer order", "detail": "Expected profit ₹1,05,000. Needs ₹1,95,000 in costs up front. Ask for an advance.", "q": "What if I accept the ₹3 lakh order?"})
    elif S["order"] == "none": opps.insert(0, {"title": "A big order may be coming", "detail": "Run the simulation to see FinCrew evaluate a ₹3,00,000 order."})
    due = "in 5 days" if S["deadline"] != "none" else "in 12 days"
    business_name = profile.get("name", "AriaCraft Supplies")
    business_type_name = business_type()
    business_rules_obj = business_rules()
    return {"business": business_name, "businessType": business_type_name, "score": sc, "level": lv, "level_tone": tone,
            "reason": S["reason"], "businessFocus": business_rules_obj.get("focus", []), "businessStep": business_rules_obj.get("step", "Protect cash and keep the business moving."),
            "breakdown": [{"label": a, "points": b} for a, b in breakdown()], "metrics": metrics(), "glossary": GLOSS,
            "priorities": priorities(), "risks": risks(), "invoices": inv, "opps": opps,
            "obligations": [{"name": "GST & statutory dues", "amount": 95000, "due": due, "status": "Set aside" if S["deadline"] == "prepared" else "Not prepared yet"}],
            "expenses": [["Salaries (8 people)", 240000], ["Raw materials", 90000], ["Rent & utilities", 45000], ["Other costs", 45000 + S["extra"]]],
            "one_offs": S["one_offs"], "history": {"months": ["May", "Jun", "Jul", "Aug", "Sep", "Oct"], "revenue": [610, 640, 660, 650, 670, 680], "expenses": [400, 410, 410, 420, 420, 420 + S["extra"] // 1000]},
            "started": S["started"], "current": S["current"], "done": S["done"], "total": len(EV),
            "finished": S["started"] and S["current"] is None and len(S["done"]) == len(EV), "audit": S["audit"], "ai_enabled": bool(os.getenv("ANTHROPIC_API_KEY", "").strip())}


@app.get("/api/state")
def api_state(): return jsonify(state())


@app.post("/api/sim/start")
def sim_start():
    global S
    S = fresh(); S["started"] = True
    log("Simulation started for AriaCraft Supplies (simulated business data).", "info"); trigger("late")
    return jsonify(state())


@app.post("/api/sim/next")
def sim_next():
    if not S["started"]: return err("Start the simulation first.")
    if S["current"]: return err("Decide on the current event first.")
    if len(S["done"]) >= len(EV): return err("All events are complete.")
    trigger(EV[len(S["done"])]); return jsonify(state())


@app.post("/api/sim/reset")
def sim_reset():
    global S
    S = fresh(); return jsonify(state())


def err(m, c=400): return jsonify(error=m), c


@app.errorhandler(Exception)
def boom(e):
    if isinstance(e, HTTPException): return err("That page or action doesn't exist." if e.code == 404 else "The request couldn't be processed.", e.code)
    app.logger.exception("FinCrew error")
    return err("FinCrew hit a problem. Please try again.", 500)


@app.get("/")
def home():
    dist_index = os.path.join(BASE, "dist", "index.html")
    if os.path.exists(dist_index):
        return send_from_directory(os.path.join(BASE, "dist"), "index.html")
    return send_from_directory(BASE, "index.html")


@app.get("/assets/<path:filename>")
def dist_assets(filename):
    dist_dir = os.path.join(BASE, "dist", "assets")
    if os.path.isdir(dist_dir):
        return send_from_directory(dist_dir, filename)
    return err("Build asset not found", 404)


@app.get("/legacy-dashboard.html")
def legacy_dashboard():
    return send_from_directory(BASE, "index.html")


@app.get("/<path:p>")
def files(p):
    if "/" not in p and os.path.splitext(p)[1] in (".html", ".js", ".css"):
        return send_from_directory(BASE, p)
    return err("Not found", 404)


if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "5000"))
    print("\n  FinCrew is running -> http://localhost:%d\n  LAN access -> http://<your-computer-ip>:%d\n  AI key: %s\n" % (port, port, "found" if os.getenv("ANTHROPIC_API_KEY", "").strip() else "not set (local reasoning mode, fully working)"))
    app.run(host=host, port=port, debug=False, threaded=True)
