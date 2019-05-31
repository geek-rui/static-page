/*!
 *  jsMap v4.0.1
 *  Copyright (C) 2018-2019, ZhaoGang
 *  Released under the MIT license.
 */
!(function ( global, factory ) {

    if ( typeof define === "function" && define.amd ) { 
        define( [ "jsmap" ], factory );
    } else if ( typeof module !== "undefined" && typeof exports === "object" ) {
        module.exports = factory();
    } else {
        global.jsMap = factory();
    }

})( typeof window !== "undefined" ? window : this, function () {

	// 内部使用的常量、变量、函数
	var UA = navigator.userAgent.toLowerCase();
	var IsMobile = !!( UA.match( /(ios|iphone|ipod|ipad|android)/ ) && "ontouchend" in document );
	var $document = window.document,
		$tip;
	var CacheJSON = {};
	function DOM ( elem, context ) {
		return [].slice.call( typeof elem === "object" ? ( elem.length ? elem : [ elem ] ) : ( context || document ).querySelectorAll( elem ) );
	}
	function getStyle ( elem, name ) {
		return window.getComputedStyle( elem, null ).getPropertyValue( name );
	}
	function setStyle ( elem, cssMap ) {
		DOM( elem ).forEach(function ( el ) {
			for ( var name in cssMap ) {
				el.style[ name ] = cssMap[ name ];
			}
		})
	}
	function setAttr ( elem, attrMap ) {
		DOM( elem ).forEach(function ( el ) {
			for ( var name in attrMap ) {
				el.setAttribute( name, attrMap[ name ] );
			}
		})
	}
	function type ( obj ) {
		return {}.toString.call( obj ).replace( /(\[object |\])/g, "" ).toLowerCase();
	}
	function isEmptyObject ( obj ) {
		for ( var name in obj ) {
			return false;
		}
		return true;
	}

	// 用于发送 ajax 请求获取地图数据
	function ajax ( url, done ) {
		var xmlHttp = new XMLHttpRequest();
		xmlHttp.onreadystatechange = function () {
			if ( xmlHttp.readyState === 4 ) {
				var status = xmlHttp.status;
				if ( ( ( status >= 200 && status < 300 ) || status === 304 ) ) {
					done( JSON.parse( xmlHttp.responseText.trim() ) );
				}
	        }
		}
		xmlHttp.open( "GET", url );
		xmlHttp.send( null );
	}

	// 在支持 classList 的 IE 浏览器中, classList 属性是在 HTMLElement.prototype 上定义的
	// 若要使其应用在 svg 元素上, 需要将 classList 定义在 Element.prototype 上
	if ( !Object.getOwnPropertyDescriptor( Element.prototype, "classList" ) ){
	    if ( HTMLElement && Object.getOwnPropertyDescriptor( HTMLElement.prototype, "classList" ) ) {
	        Object.defineProperty( Element.prototype, "classList", Object.getOwnPropertyDescriptor( HTMLElement.prototype, "classList" ) );
	    }
	}

	// 默认配置
	var defaults = {
		taiwanJSON: false,
		nanhaizhudaoJSON: false,
		name: "china",
		width: 900,
		stroke: {
			width: 1,
			color: "#f3f3f3"
		},
		fill: {
			basicColor: "#3f99f9",
			hoverColor: "#0880ff",
			clickColor: "#006bde"
		},
		areaName: {
			show: false,
			size: 12,
			basicColor: "#333",
			clickColor: "#fff"
		},
		disabled: {
			color: "#bfbfbf",
			except: false,
			name: []
		},
		selected: [],
		hide: [],
		multiple: false,
		tip: true,
		hoverCallback: function () {},
		clickCallback: function () {}
	};

	// 整合参数
	function mergeParam ( param ) {
		for ( var name in defaults ) {
			var v = defaults[ name ];
			if ( type( v ) !== "object" ) {
				if ( param[ name ] === undefined ) {
					param[ name ] = v;
				}
			} else {
				for ( var _name in v ) {
					if ( param[ name ] ) {
						if ( param[ name ][ _name ] === undefined ) {
							param[ name ][ _name ] = v[ _name ];
						}
					} else {
						param[ name ] = v;
					}
				}
			}
		}
		return param;
	}

	// 核心程序
	var jsMap = {
		version: "4.0.1",
		config: function ( selector, jsonData, options ) {
			var opt = mergeParam( options || {} );

			// 必须传入地图数据
			if ( !jsonData || type( jsonData ) !== "object" ) {
				console.warn( "来自 jsMap 的提示：[ 请传入地图数据 ]" );
				return;
			}

			// 暂无台湾省和南海诸岛的详细地图数据
			if ( opt.name === "taiwan" && !opt.taiwanJSON ) {
				console.warn( "来自 jsMap 的提示：[ 很抱歉，暂无台湾省的详细地图数据。 ]" );
				return;
			}
			if ( opt.name === "nanhaizhudao" && !opt.nanhaizhudaoJSON ) {
				console.warn( "来自 jsMap 的提示：[ 很抱歉，暂无南海诸岛的详细地图数据。 ]" );
				return;
			}

			// 取出要绘制的区域的 json 数据
			var mapData = jsonData[ opt.name ];

			var path = "",
				text = "",
				areaBox = [];

			for ( var i in mapData ) {
				var v = mapData[ i ];

				// 存储地区名称
				areaBox.push( i );

				// 绘制 path 路径
				path += '\
					<path \
						d="' + v.svg + '" \
						class="jsmap-' + i + '" \
						data-name="' + v.name + '" \
						data-id="' + i + '" \
						style="cursor:pointer;">\
					</path>\
				';

				// 设置文字
				text += '\
					<text \
						x="' + v.textPosition[ 0 ] + '" \
						y="' + v.textPosition[ 1 ] + '" \
						class="jsmap-' + i + '" \
						data-name="' + v.name + '" \
						data-id="' + i + '" \
						style="cursor:pointer;">' + v.name + '</text>\
				';
			}

			// 不显示区域名称
			if ( !opt.areaName.show ) { 
				text = "";
			}

			path = '<div \
				class="jsmap-svg-container" \
				style="\
					position:absolute;\
					top:0;\
					left:0;\
					padding:0;\
					margin:0;\
					transform-origin:center;\
					-webkit-user-select:none;\
					-moz-user-select:none;\
					-ms-user-select:none;\
					user-select:none;\
					-webkit-tap-highlight-color:transparent;"\
				>\
				<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 575 470">' + path + text + '</svg>\
			</div>';

			DOM( selector ).forEach(function ( $el ) {

				// 记录当前指定的行内样式
				var cssCache = {
					width: $el.style.width,
					height: $el.style.height,
					padding: $el.style.padding,
					position: $el.style.position
				};
				$el[ "__jsmap_csscache__" ] = cssCache;

				// 给目标元素设置样式并添加数据存储
				if ( getStyle( $el, "position" ) === "static" ) {
					$el.style.position = "relative";
				}

				$el.classList.add( "jsmap-container" );

				// 对宽高的处理
				var height;
				if ( String( opt.width ).match( /^([1-9][0-9]{0,1}|100)%$/ ) ) {
					opt.width = "100%";
					height = parseFloat( getStyle( $el, "width" ) ) / 1.8 + "px";
				} else {
					opt.width = parseInt( opt.width ) + "px";
					height = parseInt( opt.width ) / 1.8 + "px";
				}

				setStyle($el, {
					width: opt.width,
					height: height,
					padding: 0
				});
				$el.innerHTML = path;
				$el[ "__jsmap_jsondata__" ] = jsonData;
				$el[ "__jsmap_options__" ] = opt;

				var $container = DOM( ".jsmap-svg-container", $el )[ 0 ],
					$svg = DOM( "svg", $container )[ 0 ],
					$path = DOM( "path", $svg ),
					$text = DOM( "text", $svg ),
					$pathText = DOM( "path, text", $svg );

				setStyle($container, {
					width: opt.width,
					height: height
				});

				setAttr($svg, {
					width: opt.width === "100%" ? opt.width : parseFloat( opt.width ),
					height: parseFloat( height )
				});
				setStyle($svg, {
					position: "relative",
					overflow: "hidden",
					marginLeft: opt.name === "china" ? ( window.innerWidth > 700 ? "-50px" : "-30px" ) : 0
				});

				$text.length && DOM( $text ).forEach(function ( text ) { 

					// 如果 text 不是下列匹配的区域
					// 则禁用任何鼠标行为
					if ( !text.getAttribute( "data-id" ).match( /(shanghai|xianggang|aomen|nanhaizhudao|tianjin|beijing)/ ) ) {
						text.style.pointerEvents = "none";
					}
				})

				// 隐藏指定的区域
				if ( Array.isArray( opt.hide ) && opt.hide.length ) {
					opt.hide.forEach(function ( v ) {

						// 支持汉字和全拼两种形式
						DOM( $pathText ).forEach(function ( pathText ) {
							if ( pathText.getAttribute( "data-id" ) === v || pathText.getAttribute( "data-name" ) === v ) {
								pathText.style.display = "none";
							}
						})
					})
				}

				var fillBasicColor = opt.fill.basicColor;

				// 填充色 - 统一设置
				if ( typeof fillBasicColor === "string" ) {
					setAttr($path, {
						fill: fillBasicColor,
						"data-fill": fillBasicColor
					});
				}

				// 填充色 - 单独设置
				if ( type( fillBasicColor ) === "object" && !isEmptyObject( fillBasicColor ) ) {
					setAttr($path, {
						fill: defaults.fill.basicColor,
						"data-fill": defaults.fill.basicColor
					});
					for ( var name in fillBasicColor ) {
						var v = fillBasicColor[ name ];
						setAttr(DOM( ".jsmap-" + name, $svg ), {
							fill: v,
							"data-fill": v
						});
					}
				}

				// 给 path 添加过渡时间
				var timer = window.setTimeout(function () {
					DOM( $path ).forEach(function ( path ) {
						path.style.transition = ".15s";
					})
					window.clearTimeout( timer );
				}, 0);

				// 描边
				setAttr($path, {
					stroke: opt.stroke.color,
					"stroke-width": opt.stroke.width
				});

				// 文字颜色大小
				if ( opt.areaName.show ) {
					setAttr($text, {
						fill: opt.areaName.basicColor,
						"font-size": opt.areaName.size
					});
				}

				// 禁用指定的区域
				var disabledName = opt.disabled.name;
				if ( Array.isArray( disabledName ) && disabledName.length ) {
					function setDisabled ( elem ) {
						DOM( elem ).forEach(function ( el ) {
							el.classList.add( "jsmap-disabled" );
							el.style.cursor = "not-allowed";
							if ( el.nodeName.toLowerCase() !== "text" ) {
								el.setAttribute( "fill", opt.disabled.color );
							}
						})
					}

					// 反选
					if ( opt.disabled.except ) {
						var result = [];
						disabledName.forEach(function ( v ) {

							// 支持汉字和全拼两种形式
							if ( !v.match( /[a-z]/ ) ) {
								DOM( $path ).forEach(function ( path ) {
									if ( path.getAttribute( "data-name" ) === v ) {
										result.push( path.getAttribute( "data-id" ) );
									}
								})
							} else {
								result.push( v );
							}
						})
						
						// 克隆一个含有地区名称的数组
						var cloneNames = areaBox.map(function ( name ) {
							return name;
						});

						// 进行反选的筛选操作
						result.forEach(function ( v ) {
							cloneNames.splice( cloneNames.indexOf( v ), 1 );
						})

						// 设置禁用效果
						cloneNames.forEach(function ( v ) {
							setDisabled( DOM( ".jsmap-" + v, $el ) );
						})
					} else {
						disabledName.forEach(function ( v ) {

							// 设置禁用效果
							setDisabled( DOM( ".jsmap-" + v, $el ) );
						})
					}
				}

				// 悬浮提示层
				if ( opt.tip ) {
					if ( !DOM( "#jsmap-tip-layer" )[ 0 ] ) {
						document.body.insertAdjacentHTML("beforeend", '<div \
							id="jsmap-tip-layer" \
							style="\
								position:absolute;\
								top:0;\
								left:0;\
								z-index:999;\
								display:inline-block;\
								width:auto;\
								height:auto;\
								overflow:hidden;\
								display:none;\
							"\
						></div>' );
						$tip = DOM( "#jsmap-tip-layer" )[ 0 ];
					}
				}

				// 事件集合
				areaBox.forEach(function ( v ) {
					DOM( DOM( ".jsmap-" + v, $el ) ).forEach(function ( elem ) {
						elem.addEventListener("mouseenter", function () {
							if ( IsMobile ) {
								return;
							}

							var _this = this; 

							// 如果此区域被禁用
							// 则无任何事件
							if ( _this.classList.contains( "jsmap-disabled" ) ) {
								return;
							}

							// 鼠标悬浮时的填充色 ( 未被点击过的情况下 )
							if ( !_this.classList.contains( "jsmap-clicked" ) ) {

								// 克隆一个含有地区名称的数组
								var cloneAllName = areaBox.map(function ( name ) {
									return name;
								});

								if ( type( opt.fill.hoverColor ) === "string" ) {
									if ( _this.nodeName.toLowerCase() === "path" ) {
										_this.setAttribute( "fill", opt.fill.hoverColor );
									}
								}

								if ( type( opt.fill.hoverColor ) === "object" && !isEmptyObject( opt.fill.hoverColor ) ) {
									for ( var i in opt.fill.hoverColor ) {
										var v = opt.fill.hoverColor[ i ];
										if ( _this.getAttribute( "class" ).indexOf( "jsmap-" + i ) > -1 ) {
											_this.setAttribute( "fill", v );
										}
										cloneAllName.splice( cloneAllName.indexOf( i ), 1 );
									}

									// 未特殊设置的地区仍保持默认配置色
									cloneAllName.forEach(function ( area ) {
										if ( _this.getAttribute( "class" ).indexOf( "jsmap-" + v ) > -1 ) {
											_this.setAttribute( "fill", defaults.fill.hoverColor );
										}
									})
								}
							}

							// 悬浮回调事件
							opt.hoverCallback( _this.getAttribute( "data-id" ), _this.getAttribute( "data-name" ) );

							// 悬浮提示框
							if ( opt.tip ) {

								// 为 true 时显示地区的汉字名称
								if ( opt.tip === true ) {
									$tip.innerHTML = '<div \
										style="\
											padding:10px 12px;\
											color:#fff;\
											font-size:14px;\
											text-align:center;\
											border-radius:4px;\
											border:#777 solid 1px;\
											background:rgba(0,0,0,.75);"\
									>' + _this.getAttribute( "data-name" ) + '</div>';
								}

								// 是函数时可显示自定义内容
								// 函数的参数包含了地区的全拼和汉语名称
								if ( type( opt.tip ) === "function" ) {
									$tip.innerHTML = opt.tip( _this.getAttribute( "data-id" ), _this.getAttribute( "data-name" ) );
								}

								// 悬浮移动事件
								$document.onmousemove = function ( event ) {
									var x = event.pageX + 12 + "px",
										y = event.pageY + 12 + "px";
									setStyle($tip, {
										transform: "translate3d(" + x + ", " + y + ", 0)",
										display: "block"
									});
								}
							}
						})
						elem.addEventListener("mouseleave", function () {
							if ( IsMobile ) {
								return;
							}

							// 如果此区域被禁用
							// 则无任何事件
							if ( this.classList.contains( "jsmap-disabled" ) ) {
								return;
							}

							// 恢复原始填充色 ( 未被点击过的情况下 )
							if ( !this.classList.contains( "jsmap-clicked" ) ) {
								if ( this.nodeName.toLowerCase() === "path" ) {
									this.setAttribute( "fill", this.getAttribute( "data-fill" ) );
								}
							}

							// 悬浮框内容清空并恢复位置
							if ( opt.tip ) {
								$tip.innerHTML = "";
								setStyle($tip, {
									transform: "translate3d(0, 0, 0)",
									display: "none"
								});
								$document.onmousemove = null;
							}
						})
						elem.addEventListener("click", function () {
							var _this = this;

							// 如果此区域被禁用
							// 则无任何事件
							if ( _this.classList.contains( "jsmap-disabled" ) ) {
								return;
							}

							var id = _this.getAttribute( "data-id" );

							// 点击后的填充色
							if ( opt.fill.clickColor === false ) {
								return;
							} else {

								// 克隆一个含有地区名称的数组
								var cloneAllName = areaBox.map(function ( name ) {
									return name;
								});

								if ( typeof opt.fill.clickColor === "string" ) {
									if ( _this.nodeName.toLowerCase() === "path" ) {
										_this.setAttribute( "fill", opt.fill.clickColor );
									}
								}
								if ( type( opt.fill.clickColor ) === "object" && !isEmptyObject( opt.fill.clickColor ) ) {
									for ( var i in opt.fill.clickColor ) {
										var v = opt.fill.clickColor[ i ];
										if ( _this.getAttribute( "class" ).indexOf( "jsmap-" + i ) > -1 ) {
											_this.setAttribute( "fill", v );
										}
										cloneAllName.splice( cloneAllName.indexOf( i ), 1 );
									}

									// 未特殊设置的地区仍保持默认配置色
									cloneAllName.forEach(function ( area ) {
										if ( _this.getAttribute( "class" ).indexOf( "jsmap-" + area ) > -1 ) {
											_this.setAttribute( "fill", defaults.fill.clickColor );
										}
									})
								}
							}

							// 点击后的文字颜色
							if ( opt.areaName.clickColor !== false ) {
								if ( opt.areaName.show ) {
									var $elem = DOM( "text.jsmap-" + _this.getAttribute( "data-id" ), $el )[ 0 ];
									$elem.setAttribute( "fill", opt.areaName.clickColor );
									if ( !opt.multiple ) {
										DOM( DOM( "text", $el ) ).forEach(function ( text ) {
											if ( text !== $elem ) {
												text.setAttribute( "fill", opt.areaName.basicColor );
											}
										})
									}
								}
							}

							// 单选
							if ( !opt.multiple ) {
								_this.classList.add( "jsmap-clicked" );
								DOM( $pathText ).forEach(function ( pathText ) {
									if ( !pathText.classList.contains( "jsmap-" + id ) && !pathText.classList.contains( "jsmap-disabled" ) ) {
										pathText.classList.remove( "jsmap-clicked" );
										pathText.setAttribute( "fill", pathText.getAttribute( "data-fill" ) );
									}
								})
							} else {

								// 多选
								_this.classList.toggle( "jsmap-clicked" );
								if ( !_this.classList.contains( "jsmap-clicked" ) ) {
									_this.setAttribute( "fill", _this.getAttribute( "data-fill" ) );
								}
							}

							// 点击回调事件
							// 函数的参数包含了地区的全拼和汉语名称
							opt.clickCallback( _this.getAttribute( "data-id" ), _this.getAttribute( "data-name" ) );
						})
					})
				})
	
				// 默认选中
				if ( Array.isArray( opt.selected ) && opt.selected.length ) {
					opt.selected.forEach(function ( v ) {
						var $target = DOM( 'path[data-id="' + v + '"], path[data-name="' + v + '"]', $svg )[ 0 ];
						var evt = document.createEvent( "MouseEvents" );
						evt.initEvent( "click", true, true );
						$target && $target.dispatchEvent( evt );
					})
				}
			})
		},
		refresh: function ( selector ) {
			DOM( selector ).forEach(function ( $el ) {
				var cache_1 = $el[ "__jsmap_jsondata__" ],
					cache_2 = $el[ "__jsmap_options__" ];
				if ( cache_1 && cache_2 ) {
					jsMap.config( $el, cache_1, cache_2 );
				}
			})
		},
		remove: function ( selector ) {
			DOM( selector ).forEach(function ( $el ) {
				var getCssCache = $el[ "__jsmap_csscache__" ];
				if ( getCssCache ) {
					for ( var i in getCssCache ) {
						var v = getCssCache[ i ];
						if ( v ) {
							$el.style[ i ] = v;
						} else {
							$el.style.removeProperty( i );
						}
					}
				}
				$el.classList.remove( "jsmap-container" );
				$el[ "__jsmap_csscache__" ] = null;
				$el[ "__jsmap_jsondata__" ] = null;
				$el[ "__jsmap_options__" ] = null;
				$el.innerHTML = "";
			})
		},
		getSelected: function ( selector, options ) {
			var $target = DOM( ".jsmap-svg-container", DOM( selector )[ 0 ] )[ 0 ];
			
			// 被选中的区域
			var $clicked = DOM( ".jsmap-clicked", $target );

			// 默认以数组形式返回
			if ( !options ) {
				options = {
					type: "array"
				};
			}
			if ( options ) {
				if ( options.type === "array" ) {
					var a = [], 
						b = [];
					if ( !$clicked.length ) {
						return [ [], [] ];
					}
					DOM( $clicked ).forEach(function ( el ) {
						a.push( el.getAttribute( "data-id" ) );
						b.push( el.getAttribute( "data-name" ) );
					})
					return [ a, b ];
				} 
				if ( options.type === "object" ) {
					var obj = {};
					if ( !$clicked.length ) {
						return obj;
					}
					DOM( $clicked ).forEach(function ( el ) {
						obj[ el.getAttribute( "data-id" ) ] = el.getAttribute( "data-name" );
					})
					return obj;
				}
			}
		},
		getJSON: function ( url, callback ) {
			if ( !url ) {
				return;
			}
			ajax(url, function ( json ) {
				if ( type( callback ) === "function" ) {
					callback( json );
				}
			})
		},
		preloadJSON: function ( obj, callback ) {
			if ( type( obj ) === "object" && !isEmptyObject( obj ) ) {
				var cache = {};
				var totalSize = Object.keys( obj ).length;
				var successSize = 0;
				for ( var name in obj ) { 
					var url = obj[ name ];
					(function ( name, url ) {
						ajax(url, function ( json ) {
							CacheJSON[ name ] = json;
							successSize++;
							if ( successSize === totalSize ) {
								if ( type( callback ) === "function" ) {
									callback( CacheJSON );
								}
							}
						})
					})( name, url );
				}
			}
		},
		getPreloadJSON: function ( name ) {
			return !name ? CacheJSON : CacheJSON[ name ];
		}
	};

	!(function freezeJsMap ( obj ) {
        Object.freeze( obj );
        Object.keys( obj ).forEach(function ( v ) {
            if ( typeof obj[ v ] === "object" ) {
                freezeJsMap( obj[ v ] );
            }
        })
    })( jsMap );

	return jsMap;

});