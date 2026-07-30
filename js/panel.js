let rolUsuarioActual = null; // Variable global para guardar el rol

document.addEventListener("DOMContentLoaded", async () => {
    // Protección de ruta
    const token = localStorage.getItem('nexura_token');
    const usuarioStr = localStorage.getItem('nexura_usuario');

    if (!token || !usuarioStr) {
        window.location.href = "login.html";
        return;
    }

    // Inyectar datos del usuario
    const usuario = JSON.parse(usuarioStr);
    document.getElementById('nombreUsuario').textContent = usuario.nombre;
    
    // Guardamos el rol globalmente
    rolUsuarioActual = usuario.departamento || usuario.rol || 'Administración';
    document.getElementById('rolUsuario').textContent = rolUsuarioActual;

    // 1. Validar permiso para ver gráficas
    const rolesDirectivos = ['Direccion', 'Sub-Direccion', 'Gerencia de Administracion', 'Gerencia de Operaciones', 'Sistemas'];

    const accionesEncabezado = document.querySelector('.acciones-encabezado');
    const botonAgregarUsuario = `<a href="../views/registro.html" id="btnAgregarUsuario" class="btn-agregar" style="margin-right: 15px;">🆔 Agregar Usuario</a>`;

    if (rolesDirectivos.includes(rolUsuarioActual)) {

            accionesEncabezado.insertAdjacentHTML('beforeend', botonAgregarUsuario);
    } else {
        
         const seccionGraficas = document.querySelector(".graficas");
        if (seccionGraficas) {
            seccionGraficas.style.display = 'none'; // Oculta todo el bloque visualmente
        }
    }

    // Configurar cierre de sesión
    document.getElementById('btnCerrarSesion').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('nexura_token');
        localStorage.removeItem('nexura_usuario');
        window.location.href = "login.html";
    });

    // --- NUEVO: Eventos Click para las Tarjetas ---
    // Buscamos la tarjeta padre usando closest() a partir del ID del contador
    
    const tarjetaBajo = document.getElementById('cardBajo')?.closest('.tarjeta');
    if (tarjetaBajo) {
        tarjetaBajo.style.cursor = 'pointer';
        tarjetaBajo.title = "Ver productos con stock bajo";
        tarjetaBajo.addEventListener('click', () => {
            window.location.href = 'productos.html?filtro=stock_bajo';
        });
    }

    const tarjetaSinStock = document.getElementById('cardSinStock')?.closest('.tarjeta');
    if (tarjetaSinStock) {
        tarjetaSinStock.style.cursor = 'pointer';
        tarjetaSinStock.title = "Ver productos agotados";
        tarjetaSinStock.addEventListener('click', () => {
            window.location.href = 'productos.html?filtro=sin_stock';
        });
    }

    await cargarDatosDashboard(token);
});

async function cargarDatosDashboard(token) {
    const headers = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    };

    try {
        // Peticiones simultáneas a los endpoints de la API
        const [resProductos, resLotes] = await Promise.all([
            fetch("http://localhost:3000/api/productos", { headers }),
            fetch("http://localhost:3000/api/lotes", { headers })
        ]);

        if (resProductos.status === 401) {
            Swal.fire({
                icon: 'warning',
                title: 'Sesión expirada',
                text: 'Por favor, vuelve a iniciar sesión.'
            }).then(() => {
                localStorage.clear();
                window.location.href = "login.html";
            });
            return;
        }

        const productos = await resProductos.json();
        const lotes = await resLotes.json();

        procesarMetricasYGraficas(productos, lotes);

    } catch (error) {
        console.error("Error al cargar el dashboard:", error);
        Swal.fire({
            icon: 'error',
            title: 'Error de conexión',
            text: 'No se pudo conectar con el servidor para obtener las métricas.'
        });
    }
}

function procesarMetricasYGraficas(productos, lotes) {
    // 1. Calcular el stock actual agrupando los lotes por producto
    const stockPorProducto = {};
    lotes.forEach(lote => {
        // Solo sumamos si el lote está activo (buena práctica que aplicamos antes)
        if (lote.estado === 'Activo') {
            if (!stockPorProducto[lote.producto_id]) {
                stockPorProducto[lote.producto_id] = 0;
            }
            stockPorProducto[lote.producto_id] += Number(lote.cantidad_disponible);
        }
    });

    let contNormal = 0;
    let contBajo = 0;
    let contSinStock = 0;

    // NUEVO: Cambiamos "costosPorArea" a "unidadesPorArea" ya que no hay precio en productos
    const unidadesPorArea = {}; 
    const listaStock = []; 

    // 2. Evaluar cada producto contra su stock mínimo
    productos.forEach(prod => {
        const stockActual = stockPorProducto[prod.id] || 0;
        const area = prod.area_nombre || 'Sin clasificar';

        // Clasificación para las tarjetas
        if (stockActual === 0) {
            contSinStock++;
        } else if (stockActual <= prod.stock_minimo) {
            contBajo++;
        } else {
            contNormal++;
        }

        // NUEVO: Agrupación para gráfica 1 (Sumamos stock en lugar de dinero)
        if (!unidadesPorArea[area]) unidadesPorArea[area] = 0;
        unidadesPorArea[area] += stockActual;

        // Insertar en la lista para la nueva gráfica
        listaStock.push({
            nombre: prod.nombre,
            stock: stockActual
        });
    });

    // 3. Actualizar Tarjetas en el DOM
    document.getElementById('cardTotal').textContent = productos.length;
    document.getElementById('cardNormal').textContent = contNormal;
    document.getElementById('cardBajo').textContent = contBajo;
    document.getElementById('cardSinStock').textContent = contSinStock;

    // 4. Preparar el Top 5 Crítico
    // Ordenamos la lista matemáticamente de menor a mayor stock
    listaStock.sort((a, b) => a.stock - b.stock);
    // Extraemos solo los primeros 5
    const top5Critico = listaStock.slice(0, 5);

    // 5. Renderizar Gráficas (SOLO si el usuario tiene permiso)
    const rolesDirectivos = ['Direccion', 'Sub-Direccion', 'Gerencia de Administracion', 'Gerencia de Operaciones', 'Sistemas'];
    
    if (rolesDirectivos.includes(rolUsuarioActual)) {
        renderizarGraficaUnidades(unidadesPorArea); // Cambiamos el nombre de la función
        renderizarGraficaTopCritico(top5Critico); 
    }
}

function renderizarGraficaTopCritico(top5) {
    const ctx = document.getElementById('graficaTopCritico').getContext('2d');
    
    // Separamos los nombres y las cantidades para Chart.js
    const nombres = top5.map(p => p.nombre);
    const cantidades = top5.map(p => p.stock);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: nombres,
            datasets: [{
                label: 'Unidades Disponibles',
                data: cantidades,
                backgroundColor: 'rgba(243, 156, 18, 0.8)', 
                borderColor: 'rgba(230, 126, 34, 1)',
                borderWidth: 1,
                borderRadius: 5
            }]
        },
        options: {
            indexAxis: 'y', 
            responsive: true,
            plugins: {
                legend: { display: false } 
            },
            scales: {
                x: {
                    beginAtZero: true
                }
            }
        }
    });
}

// NUEVO: Función ajustada para mostrar unidades por área
function renderizarGraficaUnidades(datos) {
    const ctx = document.getElementById('graficaCostos').getContext('2d');
    const etiquetas = Object.keys(datos);
    const valores = Object.values(datos);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: etiquetas,
            datasets: [{
                label: 'Total de Unidades Físicas', // Cambiamos la etiqueta
                data: valores,
                backgroundColor: 'rgba(52, 152, 219, 0.7)',
                borderColor: 'rgba(41, 128, 185, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}