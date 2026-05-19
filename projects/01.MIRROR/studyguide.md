 학습 전략: 지금 코드를 교과서로 쓰기
                                                                                                                                                                                                            
  핵심 원칙은 코드 이미 있음 → 개념 역추적입니다. 처음부터 배우는 것보다 훨씬 빠릅니다.
                                                                                                                                                                                                            
  ---             
  Phase 1 — 지금 코드 해부 (1~2주)                                                                                                                                                                          
                                                                                                                                                                                                            
  지금 index.html 안에 Three.js의 핵심 개념이 전부 들어 있습니다.
                                                                                                                                                                                                            
  ┌────────────────────────────────────────────┬────────────────────┐                                                                                                                                       
  │                 지금 코드                  │   Three.js 개념    │                                                                                                                                       
  ├────────────────────────────────────────────┼────────────────────┤                                                                                                                                       
  │ new THREE.Scene()                          │ Scene graph 구조   │
  ├────────────────────────────────────────────┼────────────────────┤
  │ BoxGeometry, PlaneGeometry, SphereGeometry │ Geometry           │
  ├────────────────────────────────────────────┼────────────────────┤                                                                                                                                       
  │ MeshStandardMaterial, MeshBasicMaterial    │ PBR Material       │
  ├────────────────────────────────────────────┼────────────────────┤                                                                                                                                       
  │ BufferGeometry + BufferAttribute           │ 커스텀 지오메트리  │
  ├────────────────────────────────────────────┼────────────────────┤                                                                                                                                       
  │ ShaderMaterial (trail)                     │ GLSL shader        │
  ├────────────────────────────────────────────┼────────────────────┤                                                                                                                                       
  │ PositionalAudio                            │ Web Audio API + 3D │
  ├────────────────────────────────────────────┼────────────────────┤                                                                                                                                       
  │ renderer.xr.getHand()                      │ WebXR API          │
  └────────────────────────────────────────────┴────────────────────┘                                                                                                                                       
   
  할 일: 각 줄에 주석을 직접 달아보세요. 모르는 클래스가 나오면 https://threejs.org/docs 에서 검색.                                                                                                         
                  
  ---                                                                                                                                                                                                       
  Phase 2 — 에셋 붙이기에 필요한 핵심 3개 (2~3주)
                                                                                                                                                                                                            
  목표 1(예쁜 에셋 붙이기)에 직접 필요한 것만 선택 학습합니다.
                                                                                                                                                                                                            
  ① GLTF 로드 — 가장 중요
                                                                                                                                                                                                            
  import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';                                                                                                                                          
  const loader = new GLTFLoader();
  loader.load('model.glb', (gltf) => {                                                                                                                                                                      
    scene.add(gltf.scene);
  });                                                                                                                                                                                                       
                  
  지금 코드에서 XRHandModelFactory가 내부적으로 이걸 씁니다. 직접 써보면 됩니다.                                                                                                                            
   
  ② Material 심화 — PBR 파라미터 이해                                                                                                                                                                       
                  
  new THREE.MeshStandardMaterial({                                                                                                                                                                          
    map: texture,          // 색상 텍스처
    normalMap: nMap,       // 표면 굴곡                                                                                                                                                                     
    roughnessMap: rMap,    // 거칠기
    metalnessMap: mMap,    // 금속감                                                                                                                                                                        
    envMap: envTexture,    // 환경 반사
  })                                                                                                                                                                                                        
                  
  지금 코드의 roughness, metalness가 이 시스템의 일부입니다.                                                                                                                                                
                  
  ③ 조명 심화 — 에셋이 예쁘게 보이려면 조명이 핵심                                                                                                                                                          
                  
  지금 코드는 AmbientLight + DirectionalLight만 씁니다. 여기에 RectAreaLight, SpotLight, EnvironmentMap 추가를 학습하면 에셋 퀄리티가 확 올라갑니다.                                                        
                  
  ---                                                                                                                                                                                                       
  Phase 3 — AI에게 정확히 부탁하는 법 (즉시 적용)
                                                                                                                                                                                                            
  지금도 이미 잘 하고 계신데, 더 정밀하게 하려면 이 형식을 쓰세요:
                                                                                                                                                                                                            
  [파일명:줄번호] 에서 [현재 상태]를
  [Three.js 클래스/개념]을 사용해서 [원하는 결과]로 바꿔주세요.                                                                                                                                             
  조건: [제약사항]                                                                                                                                                                                          
                                                                                                                                                                                                            
  예시:                                                                                                                                                                                                     
                  
  ▎ index.html:280 의 createHandVis에서 sphere geometry를 GLTFLoader로 불러온 finger_joint.glb로 교체해주세요. 조건: 기존 joint 위치 추적 로직은 유지.                                                      
   
  이렇게 하면 AI가 어디를, 무엇으로, 어떻게 바꿀지 명확히 알 수 있습니다.                                                                                                                                   
                  
  ---                                                                                                                                                                                                       
  추천 학습 리소스 (순서대로)
                                                                                                                                                                                                            
  1. https://threejs-journey.com — Bruno Simon, 유료지만 현존 최고. 지금 코드 레벨이면 Chapter 1-3 빠르게 훑고 Chapter 4(Shaders)부터 집중
  2. https://threejs.org/examples/ — webxr_xr_hand 예제들이 지금 프로젝트와 직결                                                                                                                            
  3. 지금 코드의 ShaderMaterial — trail 셰이더를 이미 쓰고 있으니 GLSL 기초를 배우면 커스텀 이펙트 직접 설계 가능                                                                                           
                                                                                                                                                                                                            
  ---                                                                                                                                                                                                       
  다음 단계 제안                                                                                                                                                                                            
                                                                                                                                                                                                            
  지금 당장은 이렇게 시작하면 됩니다:
                                                                                                                                                                                                            
  1. GLTFLoader로 임의의 .glb 파일 하나를 wristPanel.mesh 위치에 붙여보기                                                                                                                                   
  2. MeshStandardMaterial의 map에 텍스처 하나 연결해보기                                                                                                                                                    
  3. 이 두 개만 해봐도 에셋 파이프라인 전체를 이해하게 됩니다                                                                                                                                               
                                                                                                                                                                                                            
  어떤 에셋을 붙일지 아이디어가 생기면, 지금처럼 단계별로 같이 구현하면 됩니다.                                                                                                                             
                                                              
