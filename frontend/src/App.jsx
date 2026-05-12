import { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";
import jsPDF from "jspdf";
const API = import.meta.env.VITE_API_URL;

function App() {
  const [tab, setTab] = useState("school");
  const [cities, setCities] = useState([]);
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [receipts, setReceipts] = useState([]); // ✅ NEW

  const [city, setCity] = useState("");
  const [cart, setCart] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    axios.get(`${API}/cities`).then(res => setCities(res.data));
    axios.get(`${API}/items`).then(res => setItems(res.data));
    fetchOrders();
    fetchReceipts(); // ✅ NEW
  }, [API]);

  const fetchOrders = () => {
    axios.get(`${API}/orders`)
      .then(res => setOrders(res.data));
  };

  const fetchReceipts = () => {
    axios.get(`${API}/receipts`)
      .then(res => setReceipts(res.data));
  };

  const formatQuantity = (qty, unit) => {
    if (unit === "Kg") return qty < 1 ? `${qty * 1000} g` : `${qty} Kg`;
    return `${qty} ${unit}`;
  };

  const addToCart = (item, qty, index) => {
    if (!qty || qty <= 0) return alert("Enter valid quantity");

    setCart(prev => {
      const existing = prev.find(it => it.name === item.name);
      if (existing) {
        return prev.map(it =>
          it.name === item.name
            ? { ...it, quantity: it.quantity + Number(qty) }
            : it
        );
      }
      return [...prev, { name: item.name, unit: item.unit, quantity: Number(qty) }];
    });

    setQuantities(prev => ({ ...prev, [index]: "" }));
  };

  const placeOrder = () => {
    if (!city || cart.length === 0) return alert("Add items");

    axios.post(`${API}/order`, { city, items: cart })
      .then(() => {
        setCart([]);
        fetchOrders();
      });
  };

  const deliver = (id) =>
    axios.put(`${API}/deliver/${id}`).then(fetchOrders);

  const adminEdit = (id, items) => {
    axios.put(`${API}/admin-edit/${id}`, { items })
      .then(fetchOrders);
  };

  const adminAccept = (id) => {
    axios.put(`${API}/admin-accept/${id}`)
      .then(fetchOrders);
  };

  const supplierEdit = (id, items) => {
    axios.put(`${API}/supplier-edit/${id}`, { items })
      .then(fetchOrders);
  };

  const handleEditChange = (orderId, index, value) => {
    setOrders(prev =>
      prev.map(o =>
        o.id === orderId
          ? {
              ...o,
              items: o.items.map((it, i) =>
                i === index ? { ...it, tempQty: Number(value) } : it
              )
            }
          : o
      )
    );
  };

  const handleAcceptChange = (orderId, itemIndex, value) => {
    setOrders(prev =>
      prev.map(o =>
        o.id === orderId
          ? {
              ...o,
              items: o.items.map((it, i) =>
                i === itemIndex ? { ...it, tempAccepted: Number(value) } : it
              )
            }
          : o
      )
    );
  };

  const submitAcceptance = (orderId) => {
    const order = orders.find(o => o.id === orderId);

    axios.put(`${API}/accept-all-items/${orderId}`, {
      items: order.items.map(it => ({
        accepted: it.tempAccepted ?? it.accepted
      }))
    }).then(() => {
      fetchOrders();
      fetchReceipts(); // ✅ refresh receipts
    });
  };

  const generateReceipt = (id) => {
    axios.post(`${API}/generate-receipt/${id}`)
      .then(() => fetchReceipts());
  };

  const downloadReceipt = (r) => {
    let content = `Receipt - ${r.orderCode}\n`;
    content += `City: ${r.city}\n\n`;

    r.items.forEach(it => {
      content += `${it.name} (${it.quantity}) → ₹${it.total}\n`;
    });

    content += `\nTotal: ₹${r.totalAmount}`;

    const blob = new Blob([content], { type: "text/plain" });

    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${r.orderCode}.txt`;

    a.click();

    window.URL.revokeObjectURL(url);
  };

  const downloadPDF = (r) => {
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString();

    // ===== HEADER =====
    doc.setFontSize(14);
    doc.text("Smart Grocery Distribution", 10, 10);
    doc.setFontSize(20, "bold");
    doc.text("INVOICE", 85, 15);

    doc.setFontSize(12, "normal");
    doc.text(`Order: ${r.orderCode}`, 10, 30);
    doc.text(`City: ${r.city}`, 10, 38);
    doc.text(`Date: ${date}`, 10, 46);

    // ===== TABLE HEADER =====
    let y = 65;

    doc.setFontSize(12);
    doc.setFont(undefined, "bold");

    doc.text("Item", 10, y);
    doc.text("Qty", 90, y, { align: "right" });
    doc.text("Price", 130, y, { align: "right" });
    doc.text("Total", 180, y, { align: "right" });

    doc.setFont(undefined, "normal");

    y += 3;
    doc.line(10, y, 200, y);

    y += 10;

    // ===== ITEMS =====
    r.items.forEach((it) => {
      doc.text(it.name, 10, y);

      doc.text(String(it.quantity), 90, y, { align: "right" });

      doc.text(`Rs ${it.price}`, 130, y, { align: "right" });

      doc.text(`Rs ${it.total}`, 180, y, { align: "right" });

      y += 10;
    });

    // ===== TOTAL =====
    y += 5;
    doc.line(10, y, 200, y);

    y += 10;

    doc.setFontSize(14);
    doc.setFont(undefined, "bold");

    doc.text(`Total: Rs ${r.totalAmount}`, 180, y, { align: "right" });

    // ===== SAVE =====
    doc.save(`${r.orderCode}.pdf`);
  };

  const downloadAllPDF = () => {
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString();

    let y = 10;

    doc.setFontSize(16);
    doc.text("Smart Grocery Distribution - All Invoices", 10, y);

    y += 10;
    doc.setFontSize(10);
    doc.text(`Date: ${date}`, 10, y);

    y += 10;

    // GROUP BY CITY
    const grouped = {};

    receipts.forEach(r => {
      if (!grouped[r.city]) grouped[r.city] = [];
      grouped[r.city].push(r);
    });

    Object.keys(grouped).forEach(city => {
      y += 10;

      doc.setFontSize(14);
      doc.setFont(undefined, "bold");
      doc.text(`City: ${city}`, 10, y);

      doc.setFont(undefined, "normal");

      grouped[city].forEach(r => {
        y += 10;

        doc.setFontSize(12);
        doc.text(`Order: ${r.orderCode}`, 10, y);

        y += 6;

        // ===== TABLE HEADER =====
        doc.setFontSize(11);
        doc.setFont(undefined, "bold");

        doc.text("Item", 12, y);
        doc.text("Qty", 90, y, { align: "right" });
        doc.text("Price", 130, y, { align: "right" });
        doc.text("Total", 180, y, { align: "right" });

        doc.setFont(undefined, "normal");

        y += 3;
        doc.line(10, y, 200, y);

        y += 8;

        // ===== ITEMS =====
        r.items.forEach(it => {
          doc.text(it.name, 12, y);

          doc.text(String(it.quantity), 90, y, { align: "right" });

          doc.text(`Rs ${it.price}`, 130, y, { align: "right" });

          doc.text(`Rs ${it.total}`, 180, y, { align: "right" });

          y += 8;
        });

        y += 5;
        doc.line(10, y, 200, y);

        y += 8;

        doc.setFont(undefined, "bold");
        doc.text(`Total: Rs ${r.totalAmount}`, 180, y, { align: "right" });

        doc.setFont(undefined, "normal");

        y += 8;

        // PAGE BREAK
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
      });
    });

    doc.save("All_Receipts.pdf");
  };

  const downloadAllTXT = () => {
    let content = "ALL RECEIPTS\n\n";

    receipts.forEach(r => {
      content += `Order: ${r.orderCode}\n`;
      content += `City: ${r.city}\n`;

      r.items.forEach(it => {
        content += `${it.name} (${it.quantity}) → Rs ${it.total}\n`;
      });

      content += `Total: Rs ${r.totalAmount}\n`;
      content += "------------------------\n";
    });

    const blob = new Blob([content], { type: "text/plain" });

    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "All_Receipts.txt";

    a.click();
    window.URL.revokeObjectURL(url);
  };

  const acceptAllOrders = () => {
    const pending = orders.filter(o => o.status === "Pending");

    // ✅ Prevent empty action
    if (pending.length === 0) {
      alert("No pending orders to accept");
      return;
    }

    Promise.all(
      pending.map(o =>
        axios.put(`${API}/admin-accept/${o.id}`)
      )
    )
      .then(() => {
        fetchOrders();
      })
      .catch(err => {
        console.error("Error accepting orders:", err);
        alert("Failed to accept all orders");
      });
  };


  const generateAllReceipts = () => {
    const completed = orders.filter(o => o.status === "Completed");

    // ✅ Prevent empty action
    if (completed.length === 0) {
      alert("No completed orders to generate receipts");
      return;
    }

    Promise.all(
      completed.map(o =>
        axios.post(`${API}/generate-receipt/${o.id}`)
      )
    )
      .then(() => {
        fetchReceipts();
      })
      .catch(err => {
        console.error("Error generating receipts:", err);
        alert("Failed to generate receipts");
      });
  };

  return (
    <div>
      <div className="header">Smart Grocery Distribution</div>

      <div className="tabs">
        <button onClick={() => setTab("school")}>School</button>
        <button onClick={() => setTab("admin")}>Admin</button>
        <button onClick={() => setTab("delivery")}>Supplier</button>
      </div>

      {/* ================= SCHOOL ================= */}
      {tab === "school" && (
        <div className="card">
          <div className="school-layout">

            <div>
              <h2>School Portal</h2>

              <div className="dropdown-container">
                <div className="dropdown-header" onClick={() => setShowDropdown(!showDropdown)}>
                  {city || "Select City"}
                </div>

                {showDropdown && (
                  <div className="dropdown-list">
                    {cities.map((c, i) => (
                      <div key={i} className="dropdown-item"
                        onClick={() => { setCity(c); setShowDropdown(false); }}>
                        {c}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {city && (
                <div className="items-grid">
                  {items.map((it, i) => (
                    <div key={i} className="item-card">
                      <h4>{it.name}</h4>
                      <input
                        placeholder="Qty"
                        value={quantities[i] || ""}
                        onChange={(e) =>
                          setQuantities({ ...quantities, [i]: e.target.value })
                        }
                      />
                      <button onClick={() => addToCart(it, quantities[i], i)}>Add</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="right-panel">
              <h3>Cart</h3>

              {cart.map((c, i) => (
                <div key={i} className="cart-row">
                  <span>{c.name}</span>
                  <span>{formatQuantity(c.quantity, c.unit)}</span>
                </div>
              ))}

              <button className="btn-primary" onClick={placeOrder}>
                Submit Order
              </button>

              <h3>My Orders</h3>

              {orders.filter(o => o.city === city).map(o => (
                <div key={o.id} className="order-card">

                  <div className="order-header">
                    <span>{o.orderCode}</span>
                    <span className={`status ${o.status.toLowerCase()}`}>
                      {o.status}
                    </span>
                  </div>

                  {o.items.map((it, j) => (
                    <div key={j} className="order-item">
                      <div>
                        <b>{it.name}</b>
                        <div className="item-stats">
                          <span>Ordered: {formatQuantity(it.quantity, it.unit)}</span>
                          <span className="accepted">Accepted: {formatQuantity(it.accepted, it.unit)}</span>
                          <span className="rejected">Rejected: {formatQuantity(it.rejected, it.unit)}</span>
                        </div>
                      </div>

                      {o.status === "Delivered" && (
                        <div className="accept-box">
                          <input
                            type="number"
                            onChange={(e) =>
                              handleAcceptChange(o.id, j, e.target.value)
                            }
                          />
                          <span>{it.unit}</span>
                        </div>
                      )}
                    </div>
                  ))}

                  {o.status === "Delivered" && (
                    <button className="btn-primary" onClick={() => submitAcceptance(o.id)}>
                      Submit Acceptance
                    </button>
                  )}
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* ================= ADMIN ================= */}
      {tab === "admin" && (
        <div className="card">
          <h2>Admin Dashboard</h2>

          <h3>Pending Orders</h3>
          <div className="admin-grid">
            {orders.filter(o => o.status === "Pending").map(o => {

              const total = o.items.reduce(
                (sum, it) => sum + (it.quantity * it.price),
                0
              );

              return (
                <div key={o.id} className="admin-card">
                  <h4>{o.city} • {o.orderCode}</h4>

                  {o.items.map((it, i) => (
                  <div key={i} className="item-row">
                    <span className="item-name">{it.name}</span>

                    <input
                      type="number"
                      className="item-input"
                      defaultValue={it.quantity}
                      onChange={(e) =>
                        handleEditChange(o.id, i, e.target.value)
                      }
                    />

                    <span className="item-price">
                      ₹{it.price}/{it.unit} × {it.quantity} = ₹{it.price * it.quantity}
                    </span>

                  </div>
                ))}

                  <div>Total: ₹{total}</div>

                  <button onClick={() =>
                    adminEdit(o.id, o.items.map(it => ({
                      quantity: it.tempQty ?? it.quantity
                    })))
                  }>Edit</button>

                  
                </div>
              );
            })}
          </div>
          <button className="btn-primary" onClick={acceptAllOrders}>
            Accept All Orders
          </button>
          

          <h3>Completed Orders</h3>
          <div className="small-grid">
            {orders.filter(o => o.status === "Completed").map(o => {

              const total = o.items.reduce(
                (sum, it) => sum + (it.accepted * it.price),
                0
              );

              return (
                <div key={o.id} className="admin-card">
                  <h4>{o.city} • {o.orderCode}</h4>

                  {o.items.map((it, j) => (
                    <div key={j}>
                      {it.name} → ₹{it.price}/{it.unit} × {it.accepted} = ₹{it.accepted * it.price}
                    </div>
                  ))}

                  <div>Total: ₹{total}</div>
                </div>
              );
            })}
          </div>

          <button className="btn-primary" onClick={generateAllReceipts}>
            Generate All Receipts
          </button>

        </div>
      )}
      

      {/* ================= SUPPLIER ================= */}
      {tab === "delivery" && (
        <div className="card">
          <h2>Supplier</h2>

          <h3>Deliveries</h3>
          <div className="admin-grid">
            {orders.filter(o => o.status === "Assigned").map(o => (
              <div key={o.id} className="supplier-card">

                <h4>{o.city} • {o.orderCode}</h4>

                {o.items.map((it, i) => (
                  <div key={i} className="item-row">

                    <span className="item-name">{it.name}</span>
                    <input
                      type="number"
                      className="item-input"
                      defaultValue={it.quantity}
                      onChange={(e) =>
                        handleEditChange(o.id, i, e.target.value)
                      }
                    />

                    <span className="item-price">
                      ₹{it.price}/{it.unit} × {it.quantity} = ₹{it.price * it.quantity}
                    </span>

                  </div>
                ))}
                <div style={{ marginTop: "10px", fontWeight: "600", color: "#1e3a8a" }}>
                  Total: ₹{
                    o.items.reduce((sum, it) => sum + (it.quantity * it.price), 0)
                  }
                </div>

                <button onClick={() =>
                  supplierEdit(o.id, o.items.map(it => ({
                    quantity: it.tempQty ?? it.quantity
                  })))
                }>Edit</button>

                <button onClick={() => deliver(o.id)}>Deliver</button>
              </div>
            ))}
          </div>

          <h3>Receipts</h3>
          <div className="small-grid">
            {receipts.map(r => (
              <div key={r.id} className="supplier-card">
                <h4>{r.city} • {r.orderCode}</h4>

                {r.items.map((it, i) => (
                  <div key={i}>
                    {it.name} ({it.quantity}) → ₹{it.price}/{it.unit} × {it.quantity} = ₹{it.total}
                  </div>
                ))}

                <div>Total: ₹{r.totalAmount}</div>
                <button onClick={() => downloadPDF(r)}>
                  Download PDF
                </button>
                <button onClick={() => downloadReceipt(r)}>TXT</button>
              </div>
            ))}
          </div>

          <button className="btn-primary" onClick={downloadAllPDF}>
            Download All PDF
          </button>

          <button className="btn-primary" onClick={downloadAllTXT}>
            Download All TXT
          </button>
        </div>
      )}

    </div>
  );
}

export default App;